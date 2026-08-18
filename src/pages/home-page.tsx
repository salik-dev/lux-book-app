import React, { useEffect, useState } from "react";
import { HeroSection } from "../components/hero-section";
import { LeadingRentalSection } from "../components/leading-rental-section";
import { FleetSection } from "../components/fleet-section";
import { WhyChooseSection } from "../components/why-choose-section";
import { GallerySection } from "../components/gallery-section";
import { DiscountSection } from "../components/discount-section";
import { FavoriteCarsSection } from "../components/favorite-cars-section";
import { GetStartedSection } from "../components/get-started-section";
import { ContactSection } from "../components/contact-section";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BookingData, CarData, CustomerData } from "@/@types/data";
// import { BookingDialog } from "../components/booking-dialog";

const BOOKING_RESTORE_KEY = "booking_restore_state";
const BANK_ID_STATUS_KEY = "bankid_auth_status";

interface SerializedBookingRestoreState {
  step: number;
  bookingData: Omit<BookingData, "startDateTime" | "endDateTime"> & {
    startDateTime: string;
    endDateTime: string;
  };
  customerData: Omit<CustomerData, "dateOfBirth"> & {
    dateOfBirth: string;
  };
}

const parseRestoreState = (
  raw: string | null
): { step: number; bookingData: BookingData; customerData: CustomerData } | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SerializedBookingRestoreState;
    return {
      step: parsed.step ?? 3,
      bookingData: {
        ...parsed.bookingData,
        startDateTime: new Date(parsed.bookingData.startDateTime),
        endDateTime: new Date(parsed.bookingData.endDateTime),
      },
      customerData: {
        ...parsed.customerData,
        dateOfBirth: new Date(parsed.customerData.dateOfBirth),
      },
    };
  } catch (error) {
    console.error("Failed to parse booking restore state:", error);
    return null;
  }
};

export default function HomePage() {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [carData, setCarData] = useState<CarData | null>(null);
  const [restoreStep, setRestoreStep] = useState<number | null>(null);
  const [restoreBookingData, setRestoreBookingData] = useState<BookingData | null>(null);
  const [restoreCustomerData, setRestoreCustomerData] = useState<CustomerData | null>(null);

  useEffect(() => {
    const restored = parseRestoreState(localStorage.getItem(BOOKING_RESTORE_KEY));
    if (!restored) return;

    setCarData(restored.bookingData.car);
    setRestoreStep(restored.step);
    setRestoreBookingData(restored.bookingData);
    setRestoreCustomerData(restored.customerData);
    setIsBookingDialogOpen(true);
  }, []);

  const handleBookingClick = () => {
    // Scroll to cars section
    const carsSection = document.getElementById('cars-section');
    if (carsSection) carsSection.scrollIntoView({ behavior: 'smooth' });
  };

  const openBookingDialog = () => {
    setIsBookingDialogOpen(true);
  };

  const closeBookingDialog = () => {
    setIsBookingDialogOpen(false);
    setRestoreStep(null);
    setRestoreBookingData(null);
    setRestoreCustomerData(null);
    localStorage.removeItem(BOOKING_RESTORE_KEY);
    localStorage.removeItem(BANK_ID_STATUS_KEY);
  };

  const handleCarSelect = (car: any) => {
    setCarData(car);
    openBookingDialog();
  };

  return (
    <>
      <HeroSection handleBookingClick={handleBookingClick} />
      <LeadingRentalSection />
      <FleetSection 
        onNavigateToBooking={openBookingDialog} 
        onCarSelect={handleCarSelect} 
      />
      <WhyChooseSection />
      <GallerySection />
      <DiscountSection />
      <FavoriteCarsSection />
      <GetStartedSection />
      <ContactSection />
      <BookingDialog
        isOpen={isBookingDialogOpen}
        onClose={closeBookingDialog}
        selectedCar={carData}
        initialStep={restoreStep ?? undefined}
        initialBookingData={restoreBookingData}
        initialCustomerData={restoreCustomerData}
      />
    </>
  );
}