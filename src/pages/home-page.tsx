import React from "react";
import { HeroSection } from "../components/hero-section";
import { LeadingRentalSection } from "../components/leading-rental-section";
import { FleetSection } from "../components/fleet-section";
import { WhyChooseSection } from "../components/why-choose-section";
import { GallerySection } from "../components/gallery-section";
import { DiscountSection } from "../components/discount-section";
import { FavoriteCarsSection } from "../components/favorite-cars-section";
import { GetStartedSection } from "../components/get-started-section";
import { ContactSection } from "../components/contact-section";
import { HomePageProps } from "../@types/data";

export default function HomePage({ onNavigateToBooking, onCarSelect }: HomePageProps) {
  return (
    <>
      <HeroSection />
      <LeadingRentalSection />
      <FleetSection 
        onNavigateToBooking={onNavigateToBooking} 
        onCarSelect={onCarSelect} 
      />
      <WhyChooseSection />
      <GallerySection />
      <DiscountSection />
      <FavoriteCarsSection />
      <GetStartedSection />
      <ContactSection />
    </>
  );
}