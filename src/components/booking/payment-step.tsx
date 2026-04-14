import React, { useEffect, useState } from "react";
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
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { PaymentStepProps } from "@/@types/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { useInitiateLogin } from "@/hooks/use-signicat-auth";

export const PaymentStep: React.FC<PaymentStepProps> = ({ bookingData, customerData, onComplete }) => {
  const BANK_ID_VERIFIED_KEY = "bankid_verified";
  const BANK_ID_STATUS_KEY = "bankid_auth_status";
  const BANK_ID_ERROR_KEY = "bankid_auth_error";
  const BOOKING_RESTORE_KEY = "booking_restore_state";
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [bankIdVerified, setBankIdVerified] = useState(false);
  const [bankIdStatus, setBankIdStatus] = useState<"idle" | "pending" | "success" | "failed" | "aborted">("idle");
  const [bankIdMessage, setBankIdMessage] = useState<string>("");
  const { mutate: initiateLogin, isPending: isBankIDPending } = useInitiateLogin();
  const [paymentMethod, setPaymentMethod] = useState<
    "stripe" | "vipps" | null
  >(null);

  useEffect(() => {
    try {
      const verified = localStorage.getItem(BANK_ID_VERIFIED_KEY) === "true";
      const status = localStorage.getItem(BANK_ID_STATUS_KEY) as
        | "idle"
        | "pending"
        | "success"
        | "failed"
        | "aborted"
        | null;
      const message = localStorage.getItem(BANK_ID_ERROR_KEY);
      setBankIdVerified(verified);
      setBankIdStatus(status ?? (verified ? "success" : "idle"));
      setBankIdMessage(message ?? "");
    } catch (error) {
      console.error("Failed to read BankID verification state:", error);
    }
  }, []);

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

  const handleBankIDLogin = async () => {
    try {
      localStorage.setItem(BANK_ID_STATUS_KEY, "pending");
      localStorage.removeItem(BANK_ID_ERROR_KEY);
      localStorage.setItem(
        BOOKING_RESTORE_KEY,
        JSON.stringify({
          step: 3,
          bookingData: {
            ...bookingData,
            startDateTime: bookingData.startDateTime.toISOString(),
            endDateTime: bookingData.endDateTime.toISOString(),
          },
          customerData: {
            ...customerData,
            dateOfBirth: customerData.dateOfBirth.toISOString(),
          },
        })
      );
      setBankIdStatus("pending");
      setBankIdMessage("");
      await initiateLogin();
    } catch (error) {
      localStorage.setItem(BANK_ID_STATUS_KEY, "failed");
      localStorage.setItem(
        BANK_ID_ERROR_KEY,
        "Kunne ikke starte BankID-innlogging. Prøv igjen."
      );
      setBankIdStatus("failed");
      setBankIdMessage("Kunne ikke starte BankID-innlogging. Prøv igjen.");
      toast({
        title: "Feil",
        description:
          "Kunne ikke starte BankID-innlogging. Prøv igjen.",
        variant: "destructive",
      });
    }
  };

  const handlePayment = async (method: "stripe" | "vipps") => {
    
    if (!bankIdVerified) {
      toast({
        title: "BankID påkrevd",
        description:
          "Bekreft identiteten med BankID før du går videre til betaling.",
        variant: "destructive",
      });
      return;
    }

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
              date_of_birth: format(customerData.dateOfBirth, 'yyyy-MM-dd'),
              driver_license_number: customerData.driverLicenseNumber,
              driver_license_file_path: customerData.driverLicenseFile ? String(customerData.driverLicenseFile) : null,
            })
            .select('id')
            .single();

          if (customerError) throw customerError;
          customerId = newCustomer.id;
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
          contract_signed_at: new Date().toISOString(),
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

      {/* BankID Authentication */}
      <Card className="card-premium border-[#334047] bg-[#232e33] text-[#b1bdc3] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5" />
            BankID-verifisering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-[#1b2529] p-4">
            <h4 className="mb-2 text-[14px] font-semibold">Identifiser deg med BankID</h4>
            <p className="text-xs tracking-wide text-[#9eabb1]">
              Før betaling må du fullføre BankID-innlogging. Etter vellykket
              innlogging kan du gå tilbake og betale bestillingen.
            </p>
          </div>

          <button
            onClick={handleBankIDLogin}
            disabled={bankIdVerified || isBankIDPending}
            className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#4e1f67] bg-gradient-to-r from-[#39134C] to-[#4A1A60] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(57,19,76,0.35)] transition-all hover:from-[#470D70] hover:to-[#5a1d7a] focus:outline-none focus:ring-2 focus:ring-[#6d2b8f]/60 focus:ring-offset-2 focus:ring-offset-[#232e33] disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-[1px]"
          >
            {isBankIDPending || bankIdStatus === "pending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starter BankID ...
              </>
            ) : bankIdVerified ? (
              <>
                <CheckCircle className="h-4 w-4" />
                BankID bekreftet
              </>
            ) : (
              "Login with BankID"
            )}
          </button>

          {bankIdVerified && (
            <div className="mt-2 rounded-md border border-emerald-300/30 bg-emerald-100/95 px-3 py-1.5 text-center text-sm font-semibold text-emerald-800">
              BankID er verifisert
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "failed" && (
            <div className="mt-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
              {bankIdMessage || "BankID-verifisering feilet. Prøv igjen."}
            </div>
          )}
          {!bankIdVerified && bankIdStatus === "aborted" && (
            <div className="mt-2 rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
              BankID ble avbrutt. Start verifisering på nytt.
            </div>
          )}
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
              disabled={!bankIdVerified || isProcessing}
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

          {!bankIdVerified && (
            <p className="text-sm text-red-300 text-center ">
              Verifiser med BankID før du velger betalingsmetode
            </p>
          )}
        </CardContent>
      </Card>

      {/* <Button
        onClick={() => bankIdVerified && handlePayment("stripe")}
        disabled={!bankIdVerified}
        className="w-full rounded-md h-9 bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        Complete Booking
      </Button> */}
    </div>
  );
};