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

interface CarData {
  id: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  description: string;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number;
  extra_km_rate: number;
  image_url: string;
  is_available: boolean;
}

interface BookingData {
  car: CarData;
  startDate: Date;
  endDate: Date;
  pickupLocation: string;
  deliveryLocation?: string;
  totalPrice: number;
  basePrice: number;
  deliveryFee: number;
  vatAmount: number;
}

interface CustomerData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  dateOfBirth: Date;
  driverLicenseFile?: File;
}

interface BookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCar: CarData | null;
}

export const BookingDialog: React.FC<BookingFlowProps> = ({
  isOpen,
  onClose,
  selectedCar,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] =
    useState<BookingData | null>(null);
  const [customerData, setCustomerData] =
    useState<CustomerData | null>(null);

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
            <div className="relative mb-12">
              <div className="flex items-center justify-between mb-2">
                {steps.map((step, index) => (
                  <div 
                    key={step.number}
                    className={`flex flex-col items-center relative z-10 ${
                      step.number <= currentStep ? 'text-primary' : 'text-gray-400'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      step.number < currentStep 
                        ? 'bg-primary/10 text-primary' 
                        : step.number === currentStep 
                          ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                          : 'bg-white border-2 border-gray-200 text-gray-400'
                    }`}>
                      {step.number < currentStep ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="font-medium">{step.number}</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${step.number === currentStep ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.title}
                    </span>
                  </div>
                ))}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-1">
                  <div 
                    className="h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${progress}%` }}
                  />
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