import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { BookingDetails } from "./booking-details";
import { CustomerForm } from "./customer-form";
import { PaymentStep } from "./payment-step";
import { ArrowLeft, Check, X } from "lucide-react";
import { BookingData, BookingFlowProps, CustomerData } from "@/@types/data";

export const BookingDialog: React.FC<BookingFlowProps> = ({
  isOpen,
  onClose,
  selectedCar,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  const steps = [
    {
      number: 1,
      // title: t('booking.step1'),
      title: "Select Dates & Location",
    },
    {
      number: 2,
      // title: t('booking.step2'),
      title: "Your Details",
    },
    {
      number: 3,
      // title: t('booking.step3')
      title: "Contract & Payment",
    },
  ];

  const handleClose = () => {
    setCurrentStep(1);
    setBookingData(null);
    setCustomerData(null);
    onClose();
  };

  const handleBookingDetailsComplete = (data: BookingData) => {
    console.log('h data', data);
    setBookingData(data);
    setCurrentStep(2);
  };

  const handleCustomerFormComplete = (data: CustomerData) => {
    setCustomerData(data);
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 bg-gray-50">
        <div className="relative
          before:absolute before:content-[''] before:top-0 before:left-0 before:right-0 before:h-2 before:bg-gradient-to-r before:from-primary before:to-primary/80"
        >
          <div className="absolute top-4 right-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="rounded-full h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="pt-12 px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Complete Your Booking</h2>
            
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="relative">
                <Progress value={progress} className="h-2 mb-8" />
                <div className="flex justify-between absolute top-0 left-0 right-0 -translate-y-1/2">
                  {steps.map((step) => (
                    <div 
                      key={step.number}
                      className={`flex flex-col items-center ${step.number <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors ${
                        step.number < currentStep 
                          ? 'bg-primary/10 text-primary' 
                          : step.number === currentStep 
                            ? 'bg-primary text-white' 
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.number < currentStep ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-sm font-medium">{step.number}</span>
                        )}
                      </div>
                      <span className="text-xs font-medium">
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            {currentStep === 1 && selectedCar && (
              <BookingDetails
                car={selectedCar}
                onComplete={handleBookingDetailsComplete}
              />
            )}

            {currentStep === 2 && bookingData && (
              <CustomerForm
                bookingData={bookingData}
                onComplete={handleCustomerFormComplete}
              />
            )}

            {currentStep === 3 && bookingData && customerData && (
              <PaymentStep
                bookingData={bookingData}
                customerData={customerData}
                onComplete={handleClose}
              />
            )}
          </div>
          
          {currentStep > 1 && (
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button 
                type="submit" 
                form={currentStep === 2 ? 'customer-form' : currentStep === 1 ? 'booking-form' : 'payment-form'}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-primary/30 transition-all duration-300"
              >
                {currentStep === 3 ? 'Complete Booking' : 'Continue'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};