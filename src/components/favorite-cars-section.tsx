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
          
          <HeroHeading title="Your Favorite Cars" />
          <HeroDescription description="Experience luxury on wheels with Prime Norge's fleet of BMW, Porsche, Audi and Mercedes cars. Drive with style and comfort, whether you need a city car like the Porsche Taycan or a sporty Audi RS6. Or head into rugged terrain with a Mercedes G-Wagon, or cruise in style in a BMW i7. Whatever you choose, you'll enjoy a smooth driving experience with Prime Norge." className="text-xl text-gray-300 mb-8 tracking-wide max-[656px]:text-md max-[500px]:text-[16px]" />

          <div className="flex gap-8 justify-center items-center">
            <Button size="lg" className="bg-[#e3c08d] text-black hover:bg-[#e3c08d]/90 group">
              <Heart className="mr-2 h-5 w-5" />
              View Favorites
            </Button>
            <Button
              variant="outline"
              size="lg"
              style={{ borderColor: "white" }}
              className="text-white bg-transparent"
            >
              Explore the Fleet
            </Button>
          </div>
          
        </div>
      </div>
    </section>
  )
}
