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
import { nb } from "date-fns/locale";
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
    return `${totalDays} ${totalDays === 1 ? "dag" : "dager"} (${totalHours} timer)`;
  };

  const decorationReview = (
    [
      bookingData.decorationFlowers && "Blomster",
      bookingData.decorationRibbon && "Bånd",
      bookingData.decorationRedCarpets && "Røde løpere",
      bookingData.decorationDriverNeed && "Sjåfør ønskes",
    ].filter(Boolean) as string[]
  );
  const contractReady = localStorage.getItem('signicat_access_token') !== null && localStorage.getItem('bankid_contract_document_id') !== null;

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
          vat_amount: bookingData.vatAmount,
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
        title: "Fullført",
        description:
          "Bestillingen er opprettet. Fullfør betaling i det nye vinduet.",
      });

      // Close the booking flow after a delay
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Betaling feilet",
        description:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "En uventet feil oppstod.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setPaymentMethod(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Booking Review */}
      <Card className="border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
        <CardHeader>
          {/* <CardTitle>{t('payment.reviewBooking')}</CardTitle> */}
          <CardTitle className="text-xl font-semibold">Gjennomgå bestilling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-[#b1bdc3]">
                {bookingData.car.name}
              </h3>
              <p className="text-sm text-[#9eabb1]">
                {format(new Date(bookingData.startDateTime), "PPP p", { locale: nb })} –{" "}
                {format(new Date(bookingData.endDateTime), "PPP p", { locale: nb })}
              </p>
              <p className="text-sm text-[#9eabb1]">
                <strong>Varighet:</strong>{" "}
                {formatBookingDuration(
                  new Date(bookingData.startDateTime),
                  new Date(bookingData.endDateTime),
                )}
              </p>
              <p className="text-sm text-[#9eabb1]">
                <strong>Henting:</strong>{" "}
                {bookingData.pickupLocation}
              </p>
              {bookingData.deliveryLocation && (
                <p className="text-sm text-[#9eabb1]">
                  <strong>Levering:</strong>{" "}
                  {bookingData.deliveryLocation}
                </p>
              )}
              <p className="text-sm text-[#9eabb1]">
                <strong>Seter:</strong>{" "}
                {bookingData.seatPricingMode === "daily-basis"
                  ? "Dagsbasis"
                  : "Fast pris"}
              </p>
              {decorationReview.length > 0 && (
                <p className="text-sm text-[#9eabb1]">
                  <strong>Dekorasjon:</strong> {decorationReview.join(", ")}
                </p>
              )}
            </div>
          </div>

          <Separator className="bg-[#46555d]" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Grunnpris:</span>
              <span>{formatPrice(bookingData.basePrice)}</span>
            </div>
            {bookingData.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Leveringsgebyr:</span>
                <span>
                  {formatPrice(bookingData.deliveryFee)}
                </span>
              </div>
            )}
            <Separator className="bg-[#46555d]" />
            <div className="flex justify-between text-lg font-bold">
              <span>Totalt:</span>
              <span className="text-primary">
                {formatPrice(bookingData.totalPrice)}
              </span>
            </div>
          </div>

          <Separator className="bg-[#46555d]" />

          <div>
            <h4 className="font-semibold mb-2 text-[14px]">
              Kundeinformasjon:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs tracking-wide">
              <div>
                <strong>Navn:</strong> {customerData.fullName}
              </div>
              <div>
                <strong>E-post:</strong> {customerData.email}
              </div>
              <div>
                <strong>Telefon:</strong> {customerData.phone}
              </div>
              <div>
                <strong>Adresse:</strong> {customerData.address}
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
          <CardTitle>Betalingsmetode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => handlePayment("stripe")}
              disabled={!contractReady || isProcessing}
              variant="outline"
              size="lg"
              className="h-20 rounded-md border border-[#46555d] bg-[#1b2529] py-12 transition-premium hover:cursor-pointer hover:border-[#E3C08D] hover:bg-[#2c3b40]"
            >
              {isProcessing && paymentMethod === "stripe" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <CreditCard className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithStripe')}</span> */}
              <span>Betal med Stripe</span>
              <span className="text-xs text-[#9eabb1]">
                Visa, Mastercard osv.
              </span>
            </Button>

            <Button
              onClick={() => handlePayment("vipps")}
              disabled={true}
              variant="outline"
              size="lg"
              className="h-20 rounded-md border border-[#46555d] bg-[#1b2529] py-12 transition-premium hover:cursor-pointer hover:border-[#E3C08D] hover:bg-[#2c3b40]"
            >
              {isProcessing && paymentMethod === "vipps" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithVipps')}</span> */}
              <span>Vipps er foreløpig utilgjengelig</span>
              <span className="text-xs text-[#9eabb1]">
                Norsk mobilbetaling
              </span>
            </Button>
          </div>

          {!contractReady && (
            <p className="text-sm text-red-300 text-center ">
              Fullfør BankID og kontrakt i forrige steg før betaling
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