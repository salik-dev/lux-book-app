import React from "react"

import { ContactSection } from "../components/contact-section"
import audiImage from "../assets/luxury-audi-sedan-in-modern-setting.jpg"

export default function ArrangementerPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${audiImage})`,
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-center text-white max-w-7xl mx-auto px-4 mt-20">
          <h1 className="text-4xl md:text-6xl font-bold text-[#E3C08D] mb-8 text-balance">Arrangementer</h1>
          <p className="text-lg md:text-xl leading-relaxed text-pretty">
            Prime Norge tilbyr mer enn bare en bil til din transportbehov. Vårt brede utvalg av arrangementer sikrer at
            du har en uforglemmelig opplevelse. Fra bryllup til bedriftsarrangementer, vi har alt organisert og du kan
            slappe av og nyte arrangementet ditt. Vårt dedikerte team, med års av erfaring i bilutleiebransjen, sørger
            for at alt går glatt. Leie av en luksusbil fra Prime betyr en bekymringsfri opplevelse.
          </p>
        </div>
      </section>

     <ContactSection />
    </main>
  )
}
