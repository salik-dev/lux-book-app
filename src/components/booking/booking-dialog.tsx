import React, { useState } from "react";
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
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);

  const steps = [
    {
      number: 1,
      title: "Velg dato og sted",
    },
    {
      number: 2,
      title: "Dine opplysninger",
    },
    {
      number: 3,
      title: "Kontrakt og betaling",
    },
  ];

  const handleClose = () => {
    setCurrentStep(1);
    setBookingData(null);
    setCustomerData(null);
    onClose();
  };

  const handleBookingDetailsComplete = (data: BookingData) => {
    setBookingData(data);
    setCurrentStep(2);
  };

  const handleCustomerFormComplete = (data: CustomerData) => {
    setCustomerData(data);
    console.log('customer data', data);
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
      <DialogContent className="max-w-4xl border border-[#334047] bg-[#232e33] p-0 text-[#b1bdc3]">
        {/* Progress Bar - New Design */}
        <div className="sticky top-0 z-10 h-2 bg-[#334047]">
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
                className="ml-4 flex items-center gap-2 text-[#b1bdc3] hover:cursor-pointer hover:bg-transparent hover:text-[#E3C08D]"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbake
              </Button>
            )}

          <div className="mx-8 mb-2 flex items-center">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
              <div className="flex min-w-[180px] flex-1 flex-col items-center gap-3 py-4">
                <div className={`w-8 h-8 flex items-center justify-center transition-all rounded-full ${
                  step.number < currentStep 
                    ? 'bg-[#E3C08D] text-white' 
                    : step.number === currentStep 
                      ? 'bg-[#E3C08D] text-white' 
                      : 'bg-transparent text-[#7e8c93] border border-[#46555d]'
                }`}>
                  {step.number < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{step.number}</span>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  step.number === currentStep ? 'text-[#E3C08D]' : 'text-[#8f8f8f]'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="mt-[-8px] h-px flex-1 bg-[#46555d]" />
              )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-8 pb-8 [scrollbar-color:#6b7280_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* <div className="bg-white shadow-sm p-6"> */}
            {currentStep === 1 && selectedCar && (
              <BookingDetails
                car={selectedCar}
                onComplete={handleBookingDetailsComplete}
                initialData={bookingData || undefined}
              />
            )}

            {currentStep === 2 && bookingData && (
              <CustomerForm
                bookingData={bookingData}
                onComplete={handleCustomerFormComplete}
                initialData={customerData || undefined}
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
        {/* </div> */}
      </DialogContent>
    </Dialog>
  );
};