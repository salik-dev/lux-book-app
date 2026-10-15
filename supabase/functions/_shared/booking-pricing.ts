/**
 * Booking price calculation, shared by the booking UI (step 1 / review) and the
 * `create-booking` edge function. The server result is authoritative; the browser
 * uses the same function only to display the price before the booking exists.
 *
 * Keep this module free of runtime-specific imports so both Vite and Deno can load it.
 */

export type PricingMode = "flat-rate" | "daily-basis" | "monthly-basis";

export interface PricingCar {
  base_price_per_hour: number | string | null;
  base_price_per_day: number | string | null;
  base_price_per_month?: number | string | null;
  deposit_amount?: number | string | null;
}

/** Days billed at the monthly rate before any remainder falls back to the daily rate. */
export const MONTH_BILLING_DAYS = 30;

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
  /** Whole 30-day months charged for monthly pricing (0 for other modes). */
  rentalMonths: number;
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
  // Monthly pricing bills whole 30-day blocks at the monthly rate; any remaining days
  // fall back to the daily rate (e.g. 45 days = 1 month + 15 days).
  const rentalMonths = input.mode === "monthly-basis" ? Math.floor(rentalDays / MONTH_BILLING_DAYS) : 0;

  let basePrice: number;
  if (input.mode === "daily-basis") {
    basePrice = roundCurrency(toAmount(input.car.base_price_per_day) * rentalDays);
  } else if (input.mode === "monthly-basis") {
    const leftoverDays = rentalDays - rentalMonths * MONTH_BILLING_DAYS;
    basePrice = roundCurrency(
      toAmount(input.car.base_price_per_month) * rentalMonths +
        toAmount(input.car.base_price_per_day) * leftoverDays,
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
    basePrice,
    deliveryFee,
    depositAmount,
    driverSurcharge,
    totalPrice,
    totalExcludingDeposit,
  };
}
