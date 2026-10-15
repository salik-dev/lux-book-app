import React, { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import { format, differenceInHours } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Clock,
  CreditCard,
  Smartphone,
  Loader2,
} from "lucide-react";
import { PaymentStepProps } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { useBookingContract } from "@/hooks/use-booking-contract";
import { ContractSigningCard } from "./contract-signing-card";

export const PaymentStep: React.FC<PaymentStepProps> = ({ bookingData, customerData, onEditDates }) => {
  const contractState = useBookingContract(bookingData, customerData);
  const { booking, busy } = contractState;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: "NOK",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatBookingDuration = (start: Date, end: Date) => {
    const totalHours = Math.max(1, differenceInHours(end, start));
    const totalDays = Math.ceil(totalHours / 24);
    return `${totalDays} ${totalDays === 1 ? "day" : "days"} (${totalHours} hours)`;
  };

  // Mirrors the step-1 pricing rule so the review shows exactly how the base price was derived.
  const pricingMode = bookingData.seatPricingMode ?? "flat-rate";
  const isDailyPricing = pricingMode === "daily-basis";
  const isMonthlyPricing = pricingMode === "monthly-basis";
  const rentalHours = Math.max(
    1,
    differenceInHours(new Date(bookingData.endDateTime), new Date(bookingData.startDateTime))
  );
  const rentalDays = Math.ceil(rentalHours / 24);
  // Monthly bills whole 30-day blocks; the remainder falls back to the daily rate.
  const rentalMonths = isMonthlyPricing ? Math.floor(rentalDays / 30) : 0;
  const monthlyLeftoverDays = rentalDays - rentalMonths * 30;

  const dayRate = Number(bookingData.car.base_price_per_day ?? 0);
  const hourRate = Number(bookingData.car.base_price_per_hour ?? 0);
  const monthRate = Number(bookingData.car.base_price_per_month ?? 0);

  const pricingModeLabel = isMonthlyPricing
    ? "Per month pricing"
    : isDailyPricing
      ? "Per day pricing"
      : "Per hour pricing";

  // Human-readable breakdown of how the base price was derived, for the "Rental" line.
  const rentalBreakdown = isMonthlyPricing
    ? [
        rentalMonths > 0 ? `${rentalMonths} ${rentalMonths === 1 ? "month" : "months"} × ${formatPrice(monthRate)}` : "",
        monthlyLeftoverDays > 0 ? `${monthlyLeftoverDays} ${monthlyLeftoverDays === 1 ? "day" : "days"} × ${formatPrice(dayRate)}` : "",
      ].filter(Boolean).join(" + ") || `${rentalDays} ${rentalDays === 1 ? "day" : "days"} × ${formatPrice(dayRate)}`
    : isDailyPricing
      ? `${rentalDays} ${rentalDays === 1 ? "day" : "days"} × ${formatPrice(dayRate)} / day`
      : `${rentalHours} ${rentalHours === 1 ? "hour" : "hours"} × ${formatPrice(hourRate)} / hour`;

  // Mode-aware duration shown in the review header.
  const durationText = isMonthlyPricing
    ? [
        rentalMonths > 0 ? `${rentalMonths} ${rentalMonths === 1 ? "month" : "months"}` : "",
        monthlyLeftoverDays > 0 ? `${monthlyLeftoverDays} ${monthlyLeftoverDays === 1 ? "day" : "days"}` : "",
      ].filter(Boolean).join(", ") || `${rentalDays} ${rentalDays === 1 ? "day" : "days"}`
    : formatBookingDuration(new Date(bookingData.startDateTime), new Date(bookingData.endDateTime));

  const decorationReview = (
    [
      bookingData.decorationFlowers && "Flowers",
      bookingData.decorationRibbon && "Ribbon",
      bookingData.decorationRedCarpets && "Red carpets",
      bookingData.decorationDriverNeed && "Driver requested",
    ].filter(Boolean) as string[]
  );

  // The server-computed total is what Stripe charges and what the contract states.
  const totalAmount = booking?.totalPrice ?? bookingData.totalPrice;
  const priceChanged = booking !== null && Math.abs(booking.totalPrice - bookingData.totalPrice) >= 0.01;

  // Payment unlocks once BankID and driver-licence verification are done in step 2 and
  // the rental agreement has been signed (verified server-side; create-payment re-checks).
  const bankIdVerified = localStorage.getItem('bankid_verified') === 'true';
  const licenseVerified = customerData.licenseVerified === true;
  const canPay = bankIdVerified && licenseVerified && contractState.canPay && busy === null;
  const isPaying = busy === "paying";

  const blockedReason = !bankIdVerified
    ? "Complete BankID in the previous step before payment."
    : !licenseVerified
      ? "Verify your driver's licence in the previous step before payment."
      : !contractState.canPay
        ? "Sign the rental agreement above to continue to payment."
        : null;

  const linkCustomerToBankIdVerification = async (resolvedCustomerId: string) => {
    if (!resolvedCustomerId) return;

    try {
      const verificationClient = supabase as any;
      const sessionId = localStorage.getItem("bankid_session_id");
      const nbidSid = localStorage.getItem("signicat_session_id");
      const userRaw = localStorage.getItem("signicat_user_data");
      const nin = userRaw ? JSON.parse(userRaw)?.nin ?? null : null;

      const candidates: Array<{ column: string; value: string | null }> = [
        { column: "session_id", value: sessionId },
        { column: "nbid_sid", value: nbidSid },
        { column: "nin", value: nin },
      ];

      for (const candidate of candidates) {
        if (!candidate.value) continue;
        await verificationClient
          .from("bankid_verifications")
          .update({ customer_id: resolvedCustomerId })
          .eq(candidate.column, candidate.value);
      }
    } catch (error) {
      // Non-blocking: booking/payment should continue even if linkage update fails.
      console.error("Failed to link customer_id to bankid_verifications:", error);
    }
  };

  // Link the BankID verification to the customer once the server has resolved it.
  const linkedCustomerId = useRef<string | null>(null);
  useEffect(() => {
    const customerId = booking?.customerId;
    if (!customerId || linkedCustomerId.current === customerId) return;
    linkedCustomerId.current = customerId;
    void linkCustomerToBankIdVerification(customerId);
  }, [booking?.customerId]);

  return (
    <div className="space-y-6 rounded-xl border border-[#46555d] bg-[#1c262b] p-6">
      {/* Booking Review */}
      <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
        <CardHeader>
          {/* <CardTitle>{t('payment.reviewBooking')}</CardTitle> */}
          <CardTitle className="text-xl font-semibold">Review booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-[#b1bdc3]">
                {bookingData.car.name}
              </h3>
              <p className="text-sm text-[#9eabb1]">
                {format(new Date(bookingData.startDateTime), "PPP p", { locale: enUS })} –{" "}
                {format(new Date(bookingData.endDateTime), "PPP p", { locale: enUS })}
              </p>
              <p className="text-sm text-[#9eabb1]">
                <strong>Duration:</strong>{" "}
                {durationText}
              </p>
              <p className="text-sm text-[#9eabb1]">
                <strong>Pickup:</strong>{" "}
                {bookingData.pickupLocation}
              </p>
              {bookingData.deliveryLocation && (
                <p className="text-sm text-[#9eabb1]">
                  <strong>Delivery:</strong>{" "}
                  {bookingData.deliveryLocation}
                </p>
              )}
              {decorationReview.length > 0 && (
                <p className="text-sm text-[#9eabb1]">
                  <strong>Decoration:</strong> {decorationReview.join(", ")}
                </p>
              )}
            </div>
          </div>

          <Separator className="bg-[#46555d]" />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[14px] font-semibold">Price summary</h4>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3C08D]/40 bg-[#E3C08D]/10 px-2.5 py-0.5 text-xs font-medium text-[#E3C08D]">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {pricingModeLabel}
              </span>
            </div>

            <div className="space-y-2 rounded-md border border-[#3f4d54] bg-[#1b2529] p-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p>Rental</p>
                  <p className="text-xs text-[#8a979d]">
                    {rentalBreakdown}
                  </p>
                </div>
                <span className="tabular-nums">{formatPrice(bookingData.basePrice)}</span>
              </div>
              {(bookingData.driverSurcharge ?? 0) > 0 && (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p>Driver surcharge</p>
                    <p className="text-xs text-[#8a979d]">25% of rental</p>
                  </div>
                  <span className="tabular-nums">{formatPrice(bookingData.driverSurcharge ?? 0)}</span>
                </div>
              )}
              {bookingData.deliveryFee > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Delivery fee</span>
                  <span className="tabular-nums">{formatPrice(bookingData.deliveryFee)}</span>
                </div>
              )}
              {(bookingData.depositAmount ?? 0) > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Deposit</span>
                  <span className="tabular-nums">{formatPrice(bookingData.depositAmount ?? 0)}</span>
                </div>
              )}
              <Separator className="bg-[#46555d]" />
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[#d0d9dd]">Total amount</p>
                  <p className="text-xs text-[#8a979d]">Amount charged at checkout (NOK)</p>
                </div>
                <span className="text-xl font-bold tabular-nums text-[#E3C08D]">
                  {formatPrice(totalAmount)}
                </span>
              </div>
              {priceChanged && (
                <p role="status" className="text-xs text-[#E3C08D]">
                  The price was updated to the car's current rates. This is the amount on your contract and at checkout.
                </p>
              )}
            </div>
          </div>

          <Separator className="bg-[#46555d]" />

          <div>
            <h4 className="font-semibold mb-2 text-[14px]">
              Customer information:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs tracking-wide">
              <div>
                <strong>Name:</strong> {customerData.fullName}
              </div>
              <div>
                <strong>Email:</strong> {customerData.email}
              </div>
              <div>
                <strong>Phone:</strong> {customerData.phone}
              </div>
              <div>
                <strong>Address:</strong> {customerData.address}
                , {customerData.postalCode} {customerData.city}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rental agreement (Idura signing) */}
      <ContractSigningCard state={contractState} onEditDates={onEditDates} />

      {/* Payment Methods */}
      <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
        <CardHeader>
          {/* <CardTitle>{t('payment.paymentMethod')}</CardTitle> */}
          <CardTitle>Payment method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={contractState.pay}
              disabled={!canPay}
              aria-busy={isPaying}
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-1 rounded-md border-2 border-[#E3C08D]/50 bg-[#1b2529] px-4 py-3 shadow-[0_0_0_1px_rgba(227,192,141,0.15)] transition-premium hover:cursor-pointer hover:border-[#E3C08D] hover:bg-[#2c3b40] hover:shadow-[0_0_16px_rgba(227,192,141,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#232e33] disabled:opacity-50"
            >
              {isPaying ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="h-6 w-6" aria-hidden />
              )}
              {/* <span>{t('payment.payWithStripe')}</span> */}
              <span>Pay with Stripe</span>
              <span className="text-xs text-[#9eabb1]">
                Visa, Mastercard etc.
              </span>
            </Button>

            <Button
              disabled={true}
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-1 rounded-md border border-[#3a464c] bg-[#1b2529]/60 px-4 py-3 opacity-60 transition-premium"
            >
              <Smartphone className="h-6 w-6" aria-hidden />
              {/* <span>{t('payment.payWithVipps')}</span> */}
              <span>Vipps is currently unavailable</span>
              <span className="text-xs text-[#9eabb1]">
                Norwegian mobile payment
              </span>
            </Button>
          </div>

          {blockedReason && (
            <p className="text-sm text-red-300 text-center">{blockedReason}</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
};