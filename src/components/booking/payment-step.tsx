import React, { useState } from "react";
import { Button } from "../ui/button";
import { Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Separator } from "../ui/separator";
import { useToast } from "../../hooks/use-toast";
import { format, differenceInHours } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CreditCard,
  Smartphone,
  Loader2,
} from "lucide-react";
import { PaymentStepProps } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

export const PaymentStep: React.FC<PaymentStepProps> = ({ bookingData, customerData, onComplete }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "stripe" | "vipps" | null
  >(null);

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

  const decorationReview = (
    [
      bookingData.decorationFlowers && "Flowers",
      bookingData.decorationRibbon && "Ribbon",
      bookingData.decorationRedCarpets && "Red carpets",
      bookingData.decorationDriverNeed && "Driver requested",
    ].filter(Boolean) as string[]
  );
  // Payment unlocks once BankID and driver-licence verification are done.
  // (Contract signing was replaced by the Vegvesen licence check.)
  const bankIdVerified = localStorage.getItem('bankid_verified') === 'true';
  const licenseVerified = customerData.licenseVerified === true;
  const canPay = bankIdVerified && licenseVerified;

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

  const handlePayment = async (method: "stripe" | "vipps") => {
    setIsProcessing(true);
    setPaymentMethod(method);

    try {

      // First, create customer record if user is logged in
      let customerId = null;
      // if (user) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', customerData.email)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              user_id: user?.id,
              full_name: customerData.fullName,
              email: customerData.email,
              phone: customerData.phone,
              address: customerData.address,
              postal_code: customerData.postalCode,
              city: customerData.city,
              driver_license_number: customerData.driverLicenseNumber,
              driver_license_file_path: customerData.driverLicenseFile ? String(customerData.driverLicenseFile) : null,
            })
            .select('id')
            .single();

          if (customerError) throw customerError;
          customerId = newCustomer.id;
        }

        if (customerId) {
          await linkCustomerToBankIdVerification(customerId);
        }
      // }

      // Create booking record
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          booking_number: `FJB${Date.now()}`,
          customer_id: customerId,
          car_id: String(bookingData.car.id),
          start_datetime: bookingData.startDateTime.toISOString(),
          end_datetime: bookingData.endDateTime.toISOString(),
          pickup_location: bookingData.pickupLocation,
          delivery_location: bookingData.deliveryLocation,
          delivery_fee: bookingData.deliveryFee,
          base_price: bookingData.basePrice,
          total_price: bookingData.totalPrice,
          with_driver: bookingData.withDriver ?? bookingData.decorationDriverNeed ?? false,
          org_name:
            customerData.bookingForCompany && customerData.orgName
              ? customerData.orgName.trim()
              : null,
          org_no:
            customerData.bookingForCompany && customerData.orgNo
              ? customerData.orgNo.trim()
              : null,
          decoration_require:
            bookingData.decorationRequired ??
            Boolean(
              bookingData.decorationFlowers ||
              bookingData.decorationRibbon ||
              bookingData.decorationRedCarpets
            ),
          decoration_flowers: bookingData.decorationFlowers ?? false,
          decoration_ribbon: bookingData.decorationRibbon ?? false,
          decoration_red_carpets: bookingData.decorationRedCarpets ?? false,
          decoration_driver_need: bookingData.decorationDriverNeed ?? false,
          seat_pricing_mode: bookingData.seatPricingMode ?? 'flat-rate',
          booking_deposit: bookingData.depositAmount ?? bookingData.car.deposit_amount ?? 0,
          status: 'active',
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      if (method === 'stripe') {

        // Call Stripe payment function
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: {
            bookingId: booking.id,
            amount: Math.round(bookingData.totalPrice * 100), // Convert to cents
            currency: 'nok',
            customerEmail: customerData.email,
            customerName: customerData.fullName,
            successUrl: `${window.location.origin}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/booking-cancelled?booking_id=${booking.id}`,
          },
        });

        if (error) throw error;

        if (data.url) {
          
          // Update booking with stripe session ID before redirecting
          await supabase
            .from('payments')
            .update({ stripe_session_id: data.sessionId })
            .eq('id', booking.id);
            
          // Redirect to Stripe Checkout
          window.location.href = data.url;
        }
      } 
      // else if (method === 'vipps') {
      //   // Call Vipps payment function
      //   const { data, error } = await supabase.functions.invoke('create-vipps-payment', {
      //     body: {
      //       bookingId: booking.id,
      //       amount: Math.round(bookingData.totalPrice * 100), // Convert to øre
      //       customerPhone: customerData.phone,
      //     },
      //   });

      //   if (error) throw error;

      //   if (data.url) {
      //     // Redirect to Vipps
      //     window.open(data.url, '_blank');
      //   }
      // }
      toast({
        title: "Completed",
        description:
          "The booking has been created. Complete payment in the new window.",
      });

      // Close the booking flow after a delay
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment failed",
        description:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setPaymentMethod(null);
    }
  };

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
                {formatBookingDuration(
                  new Date(bookingData.startDateTime),
                  new Date(bookingData.endDateTime),
                )}
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

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Base price:</span>
              <span>{formatPrice(bookingData.basePrice)}</span>
            </div>
            {bookingData.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Delivery fee:</span>
                <span>
                  {formatPrice(bookingData.deliveryFee)}
                </span>
              </div>
            )}
            {(bookingData.depositAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Deposit:</span>
                <span>{formatPrice(bookingData.depositAmount ?? 0)}</span>
              </div>
            )}
            {(bookingData.driverSurcharge ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Driver surcharge (25%):</span>
                <span>{formatPrice(bookingData.driverSurcharge ?? 0)}</span>
              </div>
            )}
            <Separator className="bg-[#46555d]" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">
                {formatPrice(bookingData.totalPrice)}
              </span>
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

      {/* Payment Methods */}
      <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
        <CardHeader>
          {/* <CardTitle>{t('payment.paymentMethod')}</CardTitle> */}
          <CardTitle>Payment method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => handlePayment("stripe")}
              disabled={!canPay || isProcessing}
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-1 rounded-md border-2 border-[#E3C08D]/50 bg-[#1b2529] px-4 py-3 shadow-[0_0_0_1px_rgba(227,192,141,0.15)] transition-premium hover:cursor-pointer hover:border-[#E3C08D] hover:bg-[#2c3b40] hover:shadow-[0_0_16px_rgba(227,192,141,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C08D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#232e33] disabled:opacity-50"
            >
              {isProcessing && paymentMethod === "stripe" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <CreditCard className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithStripe')}</span> */}
              <span>Pay with Stripe</span>
              <span className="text-xs text-[#9eabb1]">
                Visa, Mastercard etc.
              </span>
            </Button>

            <Button
              onClick={() => handlePayment("vipps")}
              disabled={true}
              variant="outline"
              size="lg"
              className="h-auto flex-col gap-1 rounded-md border border-[#3a464c] bg-[#1b2529]/60 px-4 py-3 opacity-60 transition-premium"
            >
              {isProcessing && paymentMethod === "vipps" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithVipps')}</span> */}
              <span>Vipps is currently unavailable</span>
              <span className="text-xs text-[#9eabb1]">
                Norwegian mobile payment
              </span>
            </Button>
          </div>

          {!canPay && (
            <p className="text-sm text-red-300 text-center">
              {!bankIdVerified
                ? "Complete BankID in the previous step before payment."
                : "Verify your driver's licence in the previous step before payment."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* <Button
        onClick={() => contractReady && handlePayment("stripe")}
        disabled={!contractReady}
        className="w-full rounded-md h-9 bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        Complete Booking
      </Button> */}
    </div>
  );
};