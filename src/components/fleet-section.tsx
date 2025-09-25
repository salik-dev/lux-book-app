
import React, { useState } from "react"
import { Button } from "./ui/button"
import { CarCard } from "./ui/car-card";
import lamborghiniImage from "@/assets/luxury-lamborghini-sports-car-in-city.jpg"
import audiImage from "@/assets/luxury-audi-sedan-in-modern-setting.jpg"
import rangeImage from "@/assets/luxury-range-rover-suv-in-urban-landscape.jpg"

interface HomePageProps {
  onNavigateToBooking: () => void;
  onCarSelect: (car: any) => void;
}

const vehicles = [
  {
    name: "Mercedes Benz G-Wagon",
    image: lamborghiniImage,
    price: "7.990kr",
    vehicleType: "Luksus SUV",
    doors: "4 dører, 5 seter",
    transmission: "Automatisk",
    fuel: "5 dører, 5 seter",
    category: "Automatisk",
    moreInfo: [
      "Premium lær interiør med oppvarming",
      "Firehjulstrekk system med terrengmodus",
      "Avansert sikkerhetspakke med blindsone-assistanse",
      "Panorama soltak med elektrisk betjening",
      "Harman Kardon premium lydsystem",
      "Adaptiv cruise control",
      "360-graders kamerasystem",
    ],
  },
  {
    name: "BMW i7",
    image: audiImage,
    price: "5.990kr",
    vehicleType: "Luksus Sedan",
    doors: "4 dører, 5 seter",
    transmission: "Automatisk",
    fuel: "5 dører, 5 seter",
    category: "Automatisk",
    moreInfo: [
      "Elektrisk drivlinje med 500+ km rekkevidde",
      "Executive lounge seter med massasje",
      "Bowers & Wilkins Diamond surround lyd",
      "Luftfjæring med adaptiv demping",
      "BMW Live Cockpit Professional",
      "Wireless charging og WiFi hotspot",
      "Gesture control og voice assistant",
    ],
  },
  {
    name: "Rolls Royce Ghost",
    image: rangeImage,
    price: "9.990kr",
    vehicleType: "Luksus Sedan",
    doors: "4 dører, 4 seter",
    transmission: "Automatisk",
    fuel: "5 dører, 5 seter",
    category: "Automatisk",
    moreInfo: [
      "Håndlaget interiør med finest lær",
      "Whisper quiet kabin med lyddemping",
      "Bespoke audio system med 18 høyttalere",
      "Starlight headliner med 1,340 fiber optikk",
      "Magic carpet ride luftfjæring",
      "Spirit of Ecstasy med belysning",
      "Champagne kjøler og crystal glass",
    ],
  },
]

export function FleetSection({ onNavigateToBooking, onCarSelect }: HomePageProps) {
  const [expandedCards, setExpandedCards] = useState<number[]>([])

  const handleCarSelect = (car: any) => {
    onNavigateToBooking();
    onCarSelect(car);
    console.log('v data', car);
  };

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]))
  }


  return (
    <section id="fleet" className="py-20 px-4" style={{ backgroundColor: "#0d1518" }}>
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#E3C08D] mb-4 text-balance">
            Eksklusive tilbud i dag på våre leiebiler!
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto text-pretty">
            Oppdag vårt håndplukkede utvalg av verdens fineste luksusbiler, hver vedlikeholdt til de høyeste standarder
            for fortreffelighet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:px-28 gap-8">
          {/* {vehicles.map((vehicle, index) => (
            <div 
              key={index}
              className={`bg-white overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 ${
                expandedCards.includes(index) ? 'row-span-2' : ''
              }`}
            >
              <div className="relative">
                <img
                  src={vehicle.image || '/placeholder.jpg'}
                  alt={vehicle.name}
                  className={`w-full object-cover transition-all duration-300 ${
                    expandedCards.includes(index) ? 'h-64' : 'h-48'
                  }`}
                />
                {expandedCards.includes(index) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{vehicle.name}</h3>
                      <div className="text-lg text-gray-200">{vehicle.price}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
                {!expandedCards.includes(index) && (
                  <>
                    <h3 className="text-xl font-semibold text-[#E3C08D] mb-2">{vehicle.name}</h3>
                    <div className="text-2xl font-bold text-black mb-4">{vehicle.price}</div>
                  </>
                )}
                <hr className="border-t border-gray-200 mb-4" />

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3 text-sm text-gray-700">
                    <Key className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
                    <span>Kjøretøytype: {vehicle.vehicleType}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-gray-700">
                    <Users className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
                    <span>{vehicle.doors}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-gray-700">
                    <Settings className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
                    <span>Gir: {vehicle.transmission}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleCarSelect(vehicle)}
                  className="w-full mt-4"
                >
                  Reserver nå
                </Button>

                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => toggleCard(index)}
                    className="flex items-center justify-between w-full text-left focus:outline-none"
                    aria-expanded={expandedCards.includes(index)}
                  >
                    <span className="text-[#E3C08D] font-medium">
                      {expandedCards.includes(index) ? 'Vis mindre' : 'Mer informasjon'}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-[#E3C08D] flex items-center justify-center transition-all duration-200 hover:cursor-pointer">
                      {expandedCards.includes(index) ? (
                        <Minus className="h-3 w-3 text-white" />
                      ) : (
                        <Plus className="h-3 w-3 text-white" />
                      )}
                    </div>
                  </button>

                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      expandedCards.includes(index) ? 'max-h-[1000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    <div className="space-y-3 pt-2">
                      {vehicle.moreInfo.map((info, i) => (
                        <p key={i} className="text-sm text-gray-600 flex items-start">
                          <span className="text-[#E3C08D] mr-2">•</span>
                          <span>{info}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))} */}
          {vehicles.map((car, index) => (
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

        <div className="text-center mt-12">
          <Button
            variant="outline"
            size="lg"
            className="border-[#E3C08D] text-[#E3C08D] hover:bg-[#E3C08D] hover:text-white bg-transparent"
          >
            Se hele flåten
          </Button>
        </div>
      </div>
    </section>
  )
}
