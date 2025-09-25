"use client"

import React from "react"
import { ContactSection } from "../components/contact-section"
import { Button } from "../components/ui/button"
import { Check, ChevronRight } from "lucide-react"
import mercedesImage from "../assets/bmw-x7-luxury-suv-dark-metallic.jpg"
import audiImage from "../assets/luxury-audi-sedan-in-modern-setting.jpg"

export default function OmOssPage() {

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[86vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={mercedesImage}
            alt="Luksuriøs bilutstilling"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-[#E3C08D] px-4 max-w-4xl mx-52 max-[1024px]:mx-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Om Oss</h1>
          <p className="text-xl md:text-2xl mb-8">
            Din pålitelige partner for premium bilutleie i Norge
          </p>
          <Button
            className="border border-[#E3C08D] hover:bg-[#E3C08D]/90 text-[#E3C08D] hover:text-white text-lg px-8 py-6 tracking-wide hover:cursor-pointer"
          >
            Kontakt Oss
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-4 md:px-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#E3C08D] mb-4">
              Vår Historie
            </h2>
            <div className="w-24 h-1 bg-[#E3C08D] mb-8"></div>
            <p className="text-lg text-[#fffffd] tracking-wide max-w-4xl leading-relaxed">
              Prime Norge er et ledende norsk bilutleiefirma med over 15 års erfaring i bransjen. 
              Vår lidenskap for biler og forretningsfilosofi om kundetilfredshet har gjort oss til 
              en pålitelig partner for både private og bedrifter over hele landet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-[#E3C08D] mb-6">Vår Visjon</h3>
              <p className="text-[#fffffd] tracking-wide mb-6 leading-relaxed">
                Å levere en sømløs og minneverdig bilutleieopplevelse som overgår våre kunders forventninger. 
                Vi tror på langsiktige partnerskap og er opptatt av å levere kvalitet og service uten kompromiss.
              </p>
              <h3 className="text-2xl font-bold text-[#E3C08D] mb-6 mt-10">Våre Verdier</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Kundetilfredshet er vår høyeste prioritet</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Ærlighet og åpenhet i alt vi gjør</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Kontinuerlig forbedring og innovasjon</span>
                </li>
                <Button className="border border-[#E3C08D] uppercase bg-[#E3C08D]/90 text-bold hover:text-white text-md px-8 py-6 hover:cursor-pointer mt-8">
                  Reserver en bil
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </ul>
            </div>
            <div className="relative h-96 md:h-[500px] overflow-hidden shadow-xl">
              <img
                src={audiImage}
                alt="Vårt showroom"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <ContactSection />
    </div>
  )
}