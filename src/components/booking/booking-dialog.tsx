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
        {/* Progress Bar - New Design */}
        <div className="bg-gray-200 h-2 sticky top-0 z-10">
          <div 
            className="bg-[#E3C08D] h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div>
          {currentStep > 1 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center gap-2 ml-4 hover:bg-transparent text-gray-700 hover:cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          <div className="flex items-center gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex flex-col mx-auto items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center transition-all rounded-full ${
                  step.number < currentStep 
                    ? 'bg-[#E3C08D] text-white' 
                    : step.number === currentStep 
                      ? 'bg-[#E3C08D] text-white' 
                      : 'bg-transparent text-gray-400 border border-gray-300'
                }`}>
                  {step.number < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  step.number === currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="bg-white shadow-sm p-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};