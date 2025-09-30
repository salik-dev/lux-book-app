import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { useToast } from "../../hooks/use-toast";
import { format } from "date-fns";
import {
  CreditCard,
  Smartphone,
  FileText,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { PaymentStepProps } from "@/@types/data";

export const PaymentStep: React.FC<PaymentStepProps> = ({
  bookingData,
  customerData,
  onComplete,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
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

  const handleSignContract = async () => {
    setIsProcessing(true);
    try {
      // Simulate BankID signing process
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setContractSigned(true);
      toast({
        title: "Contract Signed",
        description:
          "Your rental contract has been successfully signed with BankID.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          "Failed to sign contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async (method: "stripe" | "vipps") => {
    if (!contractSigned) {
      toast({
        title: "Contract Required",
        description:
          "Please sign the contract before proceeding with payment.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setPaymentMethod(method);

    try {
      toast({
        // title: t('payment.success'),
        title: "Success",
        description:
          "Your booking has been created. Complete payment in the new window.",
      });

      // Close the booking flow after a delay
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        // title: t('payment.error'),
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
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
      <Card className="card-premium">
        <CardHeader>
          {/* <CardTitle>{t('payment.reviewBooking')}</CardTitle> */}
          <CardTitle>Review Booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">
                {bookingData.car.name}
              </h3>
              <p className="text-muted-foreground">
                {format(bookingData.startDate, "PPP p")} -{" "}
                {format(bookingData.endDate, "PPP p")}
              </p>
              <p className="text-muted-foreground">
                <strong>Pickup:</strong>{" "}
                {bookingData.pickupLocation}
              </p>
              {bookingData.deliveryLocation && (
                <p className="text-muted-foreground">
                  <strong>Delivery:</strong>{" "}
                  {bookingData.deliveryLocation}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Base Price:</span>
              <span>{formatPrice(bookingData.basePrice)}</span>
            </div>
            {bookingData.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Delivery Fee:</span>
                <span>
                  {formatPrice(bookingData.deliveryFee)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>VAT (25%):</span>
              <span>{formatPrice(bookingData.vatAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">
                {formatPrice(bookingData.totalPrice)}
              </span>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">
              Customer Information:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
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

      {/* Contract Signing */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {/* {t('payment.terms')} */}
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-semibold mb-2">
              Rental Terms & Conditions
            </h4>
            <p className="text-sm text-muted-foreground">
              By proceeding with this booking, you agree to our
              terms and conditions including: insurance
              coverage, damage liability, age restrictions, and
              payment terms. Full terms will be provided via
              email upon booking confirmation.
            </p>
          </div>

          <Button
            onClick={handleSignContract}
            disabled={contractSigned || isProcessing}
            className="w-full bg-primary hover:bg-primary/90 hover:cursor-pointer"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {/* {t('payment.processing')} */}
                Processing
              </>
            ) : contractSigned ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Contract Signed ✓
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {/* {t('payment.signContract')} */}
                Sign Contract With BankID
              </>
            )}
          </Button>

          {contractSigned && (
            <Badge
              variant="default"
              className="w-full py-1 tracking-wide justify-center bg-green-100 text-green-800"
            >
              Contract successfully signed with BankID
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="card-premium">
        <CardHeader>
          {/* <CardTitle>{t('payment.paymentMethod')}</CardTitle> */}
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => handlePayment("stripe")}
              disabled={!contractSigned || isProcessing}
              variant="outline"
              size="lg"
              className="h-20 py-12 flex flex-col items-center border-gray-200 hover:bg-[#E3C08D] hover:border-[#E3C08D] hover:cursor-pointer transition-premium "
            >
              {isProcessing && paymentMethod === "stripe" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <CreditCard className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithStripe')}</span> */}
              <span>Pay With Stripe</span>
              <span className="text-xs text-muted-foreground">
                Visa, Mastercard, etc.
              </span>
            </Button>

            <Button
              onClick={() => handlePayment("vipps")}
              disabled={!contractSigned || isProcessing}
              variant="outline"
              size="lg"
              className="h-20 py-12 flex flex-col items-center gap-2 border-gray-200 hover:bg-[#E3C08D] hover:border-[#E3C08D] hover:cursor-pointer transition-premium"
            >
              {isProcessing && paymentMethod === "vipps" ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
              {/* <span>{t('payment.payWithVipps')}</span> */}
              <span>Pay with Vipps</span>
              <span className="text-xs text-muted-foreground">
                Norwegian mobile payment
              </span>
            </Button>
          </div>

          {!contractSigned && (
            <p className="text-sm text-red-300 text-center ">
              Please sign the contract before selecting a
              payment method
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => contractSigned && handlePayment("stripe")}
        disabled={!contractSigned}
        className="w-full bg-[#E3C08D] hover:bg-[#E3C08D]/90 text-white py-5 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        Complete Booking
      </Button>
    </div>
  );
};