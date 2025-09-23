import React, { useState } from "react";
import { Toaster } from "./components/ui/sonner";
import { ContactSection } from "./components/contact-section";
import { GetStartedSection } from "./components/get-started-section";
import { GallerySection } from "./components/gallery-section";
import { DiscountSection } from "./components/discount-section";
import { FavoriteCarsSection } from "./components/favorite-cars-section";
import { WhyChooseSection } from "./components/why-choose-section";
import { FleetSection } from "./components/fleet-section";
import { LeadingRentalSection } from "./components/leading-rental-section";
import { HeroSection } from "./components/hero-section";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

export default function App() {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [carData, setCarData] = useState({});

  const openBookingDialog = () => {
    setIsBookingDialogOpen(true);
  };

  const handleCarSelect = (car: any) => {
    setCarData(car);
    openBookingDialog();
  };

  return (
    <>
      <Toaster />
      <Header />
      <main>
        <HeroSection />
        <LeadingRentalSection />
        <FleetSection />
        <WhyChooseSection />
        <GallerySection />
        <DiscountSection />
        <FavoriteCarsSection />
        <GetStartedSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}