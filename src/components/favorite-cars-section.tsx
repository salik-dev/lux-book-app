import React from "react"
import { Button } from "./ui/button"
import { Heart } from "lucide-react"
import rangeImage from "../assets/luxury-bmw-sedan-in-city-street.jpg"
import { HeroDescription, HeroHeading } from "./common/hero-heading"

export function FavoriteCarsSection() {
  return (
    <section className="h-[60vh] relative py-20 px-4 overflow-hidden max-[656px]:px-8 max-[656px]:py-10">
      <div className="absolute inset-0 bg-cover bg-center"  style={{
            backgroundImage: `url(${rangeImage})`,
          }} />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 container mx-auto text-center">
        <div className="max-w-3xl mx-auto mt-8 max-[656px]:mt-0">
          
          <HeroHeading title="Dine favorittbiler" />
          <HeroDescription description="Opplev luksus på hjul med Prime Norge flåte av BMW, Porsche, Audi og Mercedes-biler. Kjør med stil og komfort, enten du trenger en bybil som Porsche Taycan eller en sporty AUDI RS6. Eller, ta turen inn i ulendt terreng med en Mercedes G Wagon eller cruise med stil i en BMW I7. Uansett hva du velger, vil du nyte en smidig kjøreopplevelse med Prime Norge." className="text-xl text-gray-300 mb-8 tracking-wide max-[656px]:text-md max-[500px]:text-[16px]" />
          
          <div className="flex gap-8 justify-center items-center border">
            <Button size="lg" className="bg-[#e3c08d] text-black hover:bg-[#e3c08d]/90 group">
              <Heart className="mr-2 h-5 w-5" />
              Se favoritter
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-black bg-transparent"
            >
              Utforsk flåten
            </Button>
          </div>
          
        </div>
      </div>
    </section>
  )
}
