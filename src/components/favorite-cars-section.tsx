"use client"

import React from "react"
import { Button } from "./ui/button"
import { Heart } from "lucide-react"

export function FavoriteCarsSection() {
  return (
    <section className="relative py-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[url('/luxury-car-interior-dark-elegant.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 container mx-auto text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Dine favorittbiler</h2>

          <p className="text-xl text-gray-300 mb-8">
            Oppdag vår eksklusive samling av luksusbiler som vil gjøre hver reise til en uforglemmelig opplevelse
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="bg-[#e3c08d] text-black hover:bg-yellow-500 group">
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
