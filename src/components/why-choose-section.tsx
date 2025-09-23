import React from "react";
import { Shield, Clock, Award, Headphones } from "lucide-react"

export function WhyChooseSection() {
  const benefits = [
    {
      icon: Shield,
      title: "Trygghet",
      description: "Alle våre biler er forsikret og gjennomgår regelmessige sikkerhetskontroller",
    },
    {
      icon: Clock,
      title: "24/7 Service",
      description: "Vi er tilgjengelige døgnet rundt for å hjelpe deg med alle dine behov",
    },
    {
      icon: Award,
      title: "Premium kvalitet",
      description: "Kun de beste og nyeste luksusbilene i vår eksklusive flåte",
    },
    {
      icon: Headphones,
      title: "Kundeservice",
      description: "Vårt dedikerte team sørger for en sømløs opplevelse fra start til slutt",
    },
  ]

  return (
    <section className="py-24 px-4 tracking-wide" style={{ backgroundColor: "#000000" }}>
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E3C08D] mb-4">Hvorfor velge Prime Norge?</h2>
          <p className="text-lg tracking-wide text-gray-400 max-w-2xl mx-auto">
            Vi skiller oss ut med vår eksepsjonelle service og premium kjøretøy
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center group hover:transform hover:scale-105 transition-all duration-300">
              <div className="bg-[#e3c08d] w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-yellow-500 transition-colors">
                <benefit.icon className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}