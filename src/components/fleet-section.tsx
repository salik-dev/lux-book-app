
import React, { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { CarCard } from "./ui/car-card";
import { CarCardProps, CardProps } from "../@types/data";
import { HeroDescription, HeroHeading } from "./common/hero-heading";
import { useCarFetch } from "@/hooks/use-car-fetch";
import { CarLoader } from "./common/car-loader";

export function FleetSection({ onNavigateToBooking, onCarSelect }: CardProps) {
  const [sliceCar, setSliceCar] = useState<boolean>(true);
  const [cars, setCars] = useState<CarCardProps[]>([]);
  const [loading, setLoading] = useState(true);

  const handleCarSelect = (car: any) => {
    onNavigateToBooking();
    onCarSelect(car);
  };

  const handleLoadMore = () => setSliceCar(!sliceCar);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  useEffect(() => {
    useCarFetch(setCars, setLoading);
  }, []);

  return (
    <section id="cars-section" className="py-20 px-4" style={{ backgroundColor: "#0d1518" }}>
      <div className="container mx-auto">

        <div className="text-center mb-16">
          <HeroHeading title="Eksklusive tilbud i dag på våre leiebiler!" />
          <HeroDescription description="Oppdag vårt håndplukkede utvalg av verdens fineste luksusbiler, hver vedlikeholdt til de høyeste standarder for fortreffelighet." className="text-center max-w-4xl mx-auto" />
        </div>

        {loading ? <CarLoader /> : <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:px-28 gap-8">
            {(sliceCar ? cars.slice(0, 6) : cars).map((car) => (
              <CarCard
                {...car}
                onNavigateToBooking={onNavigateToBooking}
                onCarSelect={handleCarSelect}
              />
            ))}
          </div>
          <div className="text-center mt-20">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="text-lg tracking-wide p-7 border-[#E3C08D] text-black bg-[#E3C08D] hover:bg-[#E3C08D]/90 hover:cursor-pointer transition-all duration-300 hover:text-white"
            >{sliceCar ? 'Bla gjennom alle kjøretøy' : 'Vis mindre'} </Button>
          </div>
        </>}

      </div>
    </section>
  )
}
