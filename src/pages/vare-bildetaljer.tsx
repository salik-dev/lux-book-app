"use client"
import React, { useEffect, useState } from "react"
import { CarCard } from "../components/ui/car-card"
import porscheImage from "../assets/luxury-porsche-sports-car-in-urban-environment.jpg"
import { CarCardProps } from "@/@types/data"
import { Button } from "@/components/ui/button"
import { CarLoader } from "@/components/common/car-loader"
import { useCarFetch } from "@/hooks/use-car-fetch"

export default function VareBildetaljerPage() {
  const [sliceCar, setSliceCar] = useState<boolean>(true);
  const [cars, setCars] = useState<CarCardProps[]>([]);
  const [loading, setLoading] = useState(true);

  const handleCarSelect = (vehicle: any) => {
    console.log("Selected vehicle:", vehicle)
    // Handle car selection logic here
  }

  const handleNavigateToBooking = () => {
    console.log("Navigating to booking page")
    // Handle navigate to booking logic here
  }

  const handleLoadMore = () => setSliceCar(!sliceCar);

  useEffect(() => {
    useCarFetch(setCars, setLoading);
  }, []);

  return (
    <main className="min-h-screen bg-[#0d1518]">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${porscheImage})`,
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-center text-[#E3C08D]">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-balance">Våre bildetaljedr</h1>
        </div>
      </section>

      {/* Cars Section */}
      <section className="py-16 px-4 md:px-8 pb-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-4xl tracking-wide font-bold text-center mb-8 text-[#E3C08D]">
            Eksklusive tilbud i dag på våre leiebiler!
          </h2>
          {loading ? <CarLoader /> :
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:px-28 gap-8">
                {(sliceCar ? cars.slice(0, 6) : cars).map((car) => (
                  <CarCard
                    {...car}
                    onNavigateToBooking={handleNavigateToBooking}
                    onCarSelect={handleCarSelect}
                  />
                ))}
              </div>
            </>
          }
        </div>
      </section>
      <div className="flex justify-center w-full pb-10">
        <Button
          onClick={handleLoadMore}
          variant="outline"
          size="lg"
          className="text-lg tracking-wide p-7 border-[#E3C08D] text-black bg-[#E3C08D] hover:bg-[#E3C08D]/90 hover:cursor-pointer transition-all duration-300 hover:text-white"
        >{sliceCar ? 'Bla gjennom alle kjøretøy' : 'Vis mindre'} </Button>
      </div>
    </main>
  )
}
