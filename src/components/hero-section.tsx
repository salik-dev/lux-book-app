
import React from "react";
import { Button } from "./ui/button"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <video autoPlay muted loop className="absolute inset-0 w-full h-full object-cover">
        <source
          src="https://primecars.no/wp-content/uploads/2023/11/24b23326-87a2-40b4-b946-a0feb2c2df46.mp4"
          type="video/mp4"
        />
      </video>

      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl px-44 mt-12">
          <h1 className="text-4xl sm:text-4xl lg:text-[50px] font-bold text-white mb-6 text-alance">
            Premium
            <span className="block text-[#e3c08d]">luksusbilutle</span>
          </h1>

          <p className="text-xl pl-1 sm:text-2xl text-gray-300 mb-8 max-w-2xl text-pretty">
            Lei en eksklusiv opplevelse
          </p>

          <p className="text-lg text-gray-400 pl-1 mb-8 max-w-2xl">
            Opplev luksus og komfort med våre eksklusive biler. Vi tilbyr deg en uforglemmelig kjøreopplevelse med våre
            premium kjøretøy.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pl-1 ">
            <Button size="lg" className="text-[#E3C08D] py-8 text-2xl tracking-wide border-2 border-[#E3C08D] group hover:bg-[#E3C08D] hover:text-black transition-colors hover:cursor-pointer">
              Finn din bil
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-8 h-14 rounded-full border-2 border-[#e3c08d] flex justify-center">
          <div className="w-1 h-3 rounded-full bg-[#e3c08d] mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  )
}
