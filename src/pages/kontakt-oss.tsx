"use client"

import React from "react"
import { Button } from "../components/ui/button"
import { ContactSection } from "../components/contact-section"
import { Mail, MapPin, Phone } from "lucide-react"
import lamborghiniImage from "../assets/luxury-lamborghini-sports-car-in-city.jpg"

export default function KontaktOssPage() {
  const faqsList = [
    {
      id: 1,
      title: 'Hva koster det for å leie en luksusbil fra PRIME?',
      answer: 'For å leie en luksusbil fra PRIME, må du oppfylle følgende krav: Alder: Minimum 25 år for de fleste luksusbiler og sportsbiler. For utleie til personer over 21 år er det mulig, men det kan være 3 års gyldig førerkort krav.'
    },
    {
      id: 2,
      title: 'Hvor lenge på forhånd bør jeg reservere en luksusbil?',
      answer: 'For å sikre tilgjengelighet og få den beste opplevelsen med våre luksusbiler, anbefaler vi at du reserverer 5-10 dager i forveien. Dette gir oss mulighet til å forberede alt til din ankomst.'
    },
    {
      id: 3,
      title: 'Kan jeg leie en luksusbil samme dag som jeg bestiller?',
      answer: 'Ja, det er mulig å leie bil samme dag, men vi anbefaler å bestille i forveien for å sikre tilgjengelighet. Kontakt oss direkte for å sjekke ledige biler på kort varsel.'
    },
    {
      id: 4,
      title: 'Hvor mange luksusbiler er tilgjengelige hos PRIME?',
      answer: 'Vi har et bredt utvalg av over 20 luksusbiler i vår flåte, inkludert Mercedes, BMW, Audi og Porsche. Vårt utvalg varierer, så kontakt oss for å høre om tilgjengelige biler for din ønskede periode.'
    }
  ]
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-[100vh] flex items-center aligns-center justify-center overflow-hidden bg-gray-100">
        <div className="absolute inset-0">
          <img
            src={lamborghiniImage}
            alt="Luksuriøst showroom"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto flex flex-col items-center gap-6">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-[#E3C08D]">Vi har åpent 24/7</h1>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">92 92 07 71</h2>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-8">
            <div className="flex items-center gap-3 bg-black/40 px-6 py-3 backdrop-blur-sm">
              <Mail size={36} className="text-[#E3C08D]" />
              <span className="text-lg tracking-wide text-white">hei@primebil.no</span>
            </div>
            <div className="flex items-center gap-3 bg-black/40 px-6 py-3 backdrop-blur-sm">
              <Phone size={36} className="text-[#E3C08D]" />
              <span>92 92 07 71</span>
            </div>
            <div className="flex items-center gap-3 bg-black/40 px-6 py-3 backdrop-blur-sm">
              <MapPin size={36} className="text-[#E3C08D]" />
              <span>Tvetenveien 152, 0671 Oslo</span>
            </div>
          </div>
          
          <Button className="bg-[#E3C08D] hover:cursor-pointer hover:bg-[#E3C08D]/90 text-black text-lg px-8 py-6">
            Bestill din bil nå
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 md:px-8 bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-wider mb-12 text-[#E3C08D]">Ofte spurt</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {faqsList.map((faq) => (
              <div key={faq.id} className="bg-white p-8 shadow-lg border border-gray-100 text-center">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-[#E3C08D] text-white w-4 h-4 flex items-center justify-center flex-shrink-0 mt-1 rounded-md">
                    <span className="text-sm">?</span>
                </div>
                <h3 className="text-xl font-semibold text-[#E3C08D]">
                  Hva koster det for å leie en luksusbil fra PRIME?
                </h3>
              </div>
              <p className="text-gray-600 pl-12">
                For å leie en luksusbil fra PRIME, må du oppfylle følgende krav: Alder: Minimum 25 år for de fleste
                luksusbiler og sportsbiler. For utleie til personer over 21 år er det mulig, men det kan være 3 års
                gyldig førerkort krav.
              </p>
            </div>
          ))}
          
          </div>
        </div>
      </section>

      <ContactSection />
    </div>
  )
}