/**
 * Booking price calculation, shared by the booking UI (step 1 / review) and the
 * `create-booking` edge function. The server result is authoritative; the browser
 * uses the same function only to display the price before the booking exists.
 *
 * Keep this module free of runtime-specific imports so both Vite and Deno can load it.
 */

import { calendarDuration } from "./contract/format.ts";

export type PricingMode = "flat-rate" | "daily-basis" | "monthly-basis";

export interface PricingCar {
  base_price_per_hour: number | string | null;
  base_price_per_day: number | string | null;
  base_price_per_month?: number | string | null;
  deposit_amount?: number | string | null;
}

export interface PricingInput {
  car: PricingCar;
  start: Date;
  end: Date;
  mode: PricingMode;
  withDriver: boolean;
  /** Delivery is not priced yet; kept as an explicit input so it flows into the total. */
  deliveryFee?: number;
}

export interface BookingPricing {
  /** Whole hours between start and end (minimum 1), as charged for hourly pricing. */
  rentalHours: number;
  /** Days charged for daily pricing: ceil(rentalHours / 24). */
  rentalDays: number;
  /** Whole calendar months charged for monthly pricing (0 for other modes). */
  rentalMonths: number;
  /** Leftover whole days after the calendar months, for monthly pricing (0 otherwise). */
  rentalLeftoverDays: number;
  /** Leftover whole hours after the days, for monthly pricing (0 otherwise). */
  rentalLeftoverHours: number;
  basePrice: number;
  deliveryFee: number;
  depositAmount: number;
  /** 25% of the base price when a driver is requested. */
  driverSurcharge: number;
  /** Amount charged at checkout, deposit included. */
  totalPrice: number;
  /** Rental amount excluding the deposit (used on the rental agreement). */
  totalExcludingDeposit: number;
}

const HOUR_MS = 60 * 60 * 1000;
export const DRIVER_SURCHARGE_RATE = 0.25;

const toAmount = (value: number | string | null | undefined): number => {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Rounds to øre to avoid floating point drift (e.g. 0.1 + 0.2). */
export const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

export function calculateBookingPricing(input: PricingInput): BookingPricing {
  const elapsedMs = input.end.getTime() - input.start.getTime();
  // Matches date-fns differenceInHours (truncates partial hours), minimum 1 hour.
  const rentalHours = Math.max(1, Math.trunc(elapsedMs / HOUR_MS));
  const rentalDays = Math.ceil(rentalHours / 24);

  let rentalMonths = 0;
  let rentalLeftoverDays = 0;
  let rentalLeftoverHours = 0;
  let basePrice: number;
  if (input.mode === "daily-basis") {
    basePrice = roundCurrency(toAmount(input.car.base_price_per_day) * rentalDays);
  } else if (input.mode === "monthly-basis") {
    // Bill the real Oslo calendar span: whole calendar months at the monthly rate, the
    // leftover whole days at the daily rate and the leftover whole hours at the hourly rate
    // (e.g. 2 months, 12 days, 9 hours = 2·month + 12·day + 9·hour). This matches the
    // "Agreed duration" shown on the contract. Choosing "per month" bills at least one month.
    const cal = calendarDuration(input.start, input.end);
    rentalMonths = cal.years * 12 + cal.months;
    rentalLeftoverDays = cal.days;
    rentalLeftoverHours = cal.hours;
    if (rentalMonths < 1) {
      rentalMonths = 1;
      rentalLeftoverDays = 0;
      rentalLeftoverHours = 0;
    }
    basePrice = roundCurrency(
      toAmount(input.car.base_price_per_month) * rentalMonths +
        toAmount(input.car.base_price_per_day) * rentalLeftoverDays +
        toAmount(input.car.base_price_per_hour) * rentalLeftoverHours,
    );
  } else {
    basePrice = roundCurrency(toAmount(input.car.base_price_per_hour) * rentalHours);
  }
  const deliveryFee = roundCurrency(toAmount(input.deliveryFee));
  const depositAmount = roundCurrency(toAmount(input.car.deposit_amount));
  const driverSurcharge = input.withDriver ? roundCurrency(basePrice * DRIVER_SURCHARGE_RATE) : 0;
  const totalExcludingDeposit = roundCurrency(basePrice + deliveryFee + driverSurcharge);
  const totalPrice = roundCurrency(totalExcludingDeposit + depositAmount);

  return {
    rentalHours,
    rentalDays,
    rentalMonths,
    rentalLeftoverDays,
    rentalLeftoverHours,
    basePrice,
    deliveryFee,
    depositAmount,
    driverSurcharge,
    totalPrice,
    totalExcludingDeposit,
  };
}
