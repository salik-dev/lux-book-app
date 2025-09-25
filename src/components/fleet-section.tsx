
import React, { useState } from "react"
import { Button } from "./ui/button"
import { CarCard } from "./ui/car-card";
import { vehicles } from "../constants/data";
import { HomePageProps } from "../@types/data";
import { HeroDescription, HeroHeading } from "./common/hero-heading";

export function FleetSection({ onNavigateToBooking, onCarSelect }: HomePageProps) {
  const [expandedCards, setExpandedCards] = useState<number[]>([])

  const handleCarSelect = (car: any) => {
    onNavigateToBooking();
    onCarSelect(car);
  };

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  return (
    <section id="fleet" className="py-20 px-4" style={{ backgroundColor: "#0d1518" }}>
      <div className="container mx-auto">

        <div className="text-center mb-16">
          <HeroHeading title="Eksklusive tilbud i dag på våre leiebiler!" />
          <HeroDescription description="Oppdag vårt håndplukkede utvalg av verdens fineste luksusbiler, hver vedlikeholdt til de høyeste standarder for fortreffelighet." className="text-center max-w-4xl mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:px-28 gap-8">
          {vehicles.map((car, index) => (
            <CarCard
              key={index}
              {...car}
              index={index}
              isExpanded={expandedCards.includes(index)}
              onToggleExpand={toggleCard}
              onCarSelect={handleCarSelect}
            />
          ))}
        </div>

        <div className="text-center mt-20">
          <Button
            variant="outline"
            size="lg"
            className="text-lg tracking-wide p-7 border-[#E3C08D] text-black bg-[#E3C08D] hover:bg-[#E3C08D]/90 hover:cursor-pointer transition-all duration-300 hover:text-white"
          >
          Bla gjennom alle kjøretøy
          </Button>
          
        </div>
      </div>
    </section>
  )
}
