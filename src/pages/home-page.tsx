import React, { useState } from "react";
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
import { CarData } from "@/@types/data";
// import { BookingDialog } from "../components/booking-dialog";

export default function HomePage() {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [carData, setCarData] = useState<CarData | null>(null);

  const handleBookingClick = () => {
    // Scroll to cars section
    const carsSection = document.getElementById('cars-section');
    if (carsSection) carsSection.scrollIntoView({ behavior: 'smooth' });
  };

  const openBookingDialog = () => {
    setIsBookingDialogOpen(true);
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
      <BookingDialog isOpen={isBookingDialogOpen} onClose={() => setIsBookingDialogOpen(false)} selectedCar={carData} />
    </>
  );
}