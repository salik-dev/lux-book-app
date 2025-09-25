"use client"
import React, { useState } from "react"
import  {CarCard} from "../components/ui/car-card"
import mercedesImage from "../assets/luxury-mercedes-g-class-suv-in-urban-setting.jpg"
import audiImage from "../assets/luxury-audi-sedan-in-modern-setting.jpg"
import rangeImage from "../assets/luxury-range-rover-suv-in-urban-landscape.jpg"
import toyotaImage from "../assets/luxury-toyota-land-cruiser-suv-in-city.jpg"
import porscheImage from "../assets/luxury-porsche-sports-car-in-urban-environment.jpg"
import bentleyImage from "../assets/luxury-bentley-sedan-in-premium-setting.jpg"
import bmwImage from "../assets/luxury-bmw-sedan-in-city-street.jpg"

export default function VareBildetaljerPage() {
  const [expandedCards, setExpandedCards] = useState<number[]>([])

  const cars = [
    {
      image: mercedesImage,
      price: "1.990kr",
      name: "Lukus SUV",
      vehicleType: "Lukus SUV",
      doors: "5 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Premium interiør med skinntrukne seter",
        "Avansert navigasjonssystem og infotainment",
        "Automatisk klimakontroll",
        "Sikkerhetssystemer og assistanse",
        "Bluetooth og USB-tilkobling",
      ],
    },
    {
      image: bmwImage,
      price: "2.490kr",
      name: "Lukus Sedan",
      vehicleType: "Lukus Sedan",
      doors: "5 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Elegant design med premium finish",
        "Komfortable seter for lange turer",
        "Avansert sikkerhetsteknologi",
        "Kraftig og effektiv motor",
        "Romslig bagasjerom",
      ],
    },
    {
      image: bentleyImage,
      price: "3.990kr",
      name: "Lukus Coupe",
      vehicleType: "Lukus Coupe",
      doors: "2 dører, 4 seter",
      transmission: "Automatisk",
      fuel: "2 dører, 4 seter",
      category: "Automatisk",
      moreInfo: [
        "Sportsbil med luksuriøs komfort",
        "Høyytelse motor og dynamisk kjøring",
        "Premium lydanlegg",
        "Karbon fiber detaljer",
        "Adaptiv fjæring",
      ],
    },
    {
      image: rangeImage,
      price: "2.990kr",
      name: "Sport Stasjonsvogn",
      vehicleType: "Sport Stasjonsvogn",
      doors: "5 dører, 7 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 7 seter",
      category: "Automatisk",
      moreInfo: [
        "Romslig familiebil med sportsprestanda",
        "Tredje seterad for ekstra passasjerer",
        "Stort lasteareal",
        "Firehjulstrekk for alle værforhold",
        "Premium komfort og teknologi",
      ],
    },
    {
      image: toyotaImage,
      price: "2.490kr",
      name: "Executive Sedan",
      vehicleType: "Executive Sedan",
      doors: "5 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Perfekt for forretningsreiser",
        "Stilrent og profesjonelt design",
        "Komfortable bakseter",
        "Avansert infotainment system",
        "Utmerket drivstofføkonomi",
      ],
    },
    {
      image: porscheImage,
      price: "7.990kr",
      name: "Supersportsbil",
      vehicleType: "Supersportsbil",
      doors: "2 dører, 2 seter",
      transmission: "Automatisk",
      fuel: "2 dører, 2 seter",
      category: "Automatisk",
      moreInfo: [
        "Ekstrem ytelse og hastighet",
        "Aerodynamisk design",
        "Karbon fiber karosseri",
        "Racing-inspirert interiør",
        "Avansert elektronisk stabilitetskontroll",
      ],
    },
    {
      image: audiImage,
      price: "5.990kr",
      name: "Gran Turismo",
      vehicleType: "Gran Turismo",
      doors: "2 dører, 4 seter",
      transmission: "Automatisk",
      fuel: "2 dører, 4 seter",
      category: "Automatisk",
      moreInfo: [
        "Perfekt balanse mellom komfort og ytelse",
        "Langdistanse touring kapasitet",
        "Håndverket interiør",
        "Kraftig V8 motor",
        "Adaptiv kjøredynamikk",
      ],
    },
    {
      image: audiImage,
      price: "3.990kr",
      name: "Premium Sedan",
      vehicleType: "Premium Sedan",
      doors: "5 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Toppmodell med alle tilgjengelige funksjoner",
        "Massasjeseter og klimasoner",
        "Panorama soltak",
        "Premium Bose lydanlegg",
        "Autonom kjøreassistanse",
      ],
    },
    {
      image: audiImage,
      price: "5.990kr",
      name: "Urban SUV",
      vehicleType: "Urban SUV",
      doors: "5 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Perfekt for byliv og weekend-turer",
        "Høy kjøreposisjon og god oversikt",
        "Moderne design og teknologi",
        "Effektiv hybrid drivlinje",
        "Smart tilkoblingsmuligheter",
      ],
    },
    {
      image: mercedesImage,
      price: "1.990kr",
      name: "Familie SUV",
      vehicleType: "Familie SUV",
      doors: "5 dører, 7 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 7 seter",
      category: "Automatisk",
      moreInfo: [
        "Ideell for store familier",
        "Fleksible seteløsninger",
        "Omfattende sikkerhetsutstyr",
        "Praktiske oppbevaringsløsninger",
        "Rimelig og pålitelig",
      ],
    },
  ]

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }

  const handleCarSelect = (vehicle: any) => {
    console.log("Selected vehicle:", vehicle)
    // Handle car selection logic here
  }

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
      <section className="py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-4xl tracking-wide font-bold text-center mb-8 text-[#E3C08D]">
            Eksklusive tilbud i dag på våre leiebiler!
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:px-28 gap-8">
            {cars.map((car, index) => (
              <CarCard
                key={index}
                {...car}
                index={index}
                isExpanded={expandedCards.includes(index)}
                onToggleExpand={toggleCard}
                onCarSelect={handleCarSelect}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
