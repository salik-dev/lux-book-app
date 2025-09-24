"use client"
import React from "react"
import { Key, Users, Settings, Plus, Minus } from "lucide-react"
import { Button } from "./button"

interface CarCardProps {
  image: string
  price: string
  transmission: string
  fuel: string
  category: string
  name?: string
  vehicleType?: string
  doors?: string
  moreInfo?: string[]
  index: number
  isExpanded: boolean
  onToggleExpand: (index: number) => void
  onCarSelect: (car: any) => void
}

export function CarCard({
  image,
  price,
  transmission,
  fuel,
  category,
  name = "Luksusbil",
  vehicleType,
  doors,
  moreInfo = [
    "Premium interiør med skinntrukne seter",
    "Avansert navigasjonssystem og infotainment",
    "Automatisk klimakontroll",
    "Sikkerhetssystemer og assistanse",
    "Bluetooth og USB-tilkobling",
  ],
  index,
  isExpanded,
  onToggleExpand,
  onCarSelect,
}: CarCardProps) {
  const handleCarSelect = () => {
    // onCarSelect({
    //   image,
    //   price,
    //   transmission,
    //   fuel,
    //   category,
    //   name,
    //   vehicleType: vehicleType || transmission,
    //   doors: doors || fuel,
    //   moreInfo,
    // })
  }

  return (
    <div
      className={`bg-white overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 ${
        isExpanded ? "row-span-2" : ""
      }`}
    >
      <div className="relative">
        <img
          src={image || "/placeholder.svg?height=300&width=400&query=luxury car"}
          alt={name}
          className={`w-full object-cover transition-all duration-300 ${isExpanded ? "h-64" : "h-48"}`}
        />
        {isExpanded && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">{name}</h3>
              <div className="text-lg text-gray-200">{price}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {!isExpanded && (
          <>
            <h3 className="text-xl font-semibold text-[#E3C08D] mb-2">{name}</h3>
            <div className="text-2xl font-bold text-black mb-4">{price}</div>
          </>
        )}
        <hr className="border-t border-gray-200 mb-4" />

        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <Key className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
            <span>Kjøretøytype: {vehicleType || transmission}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <Users className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
            <span>{doors || fuel}</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <Settings className="h-4 w-4 text-[#E3C08D] flex-shrink-0" />
            <span>Gir: {category}</span>
          </div>
        </div>

        <Button onClick={handleCarSelect} className="w-full mt-4 bg-[#E3C08D] hover:cursor-pointer tracking-wide hover:bg-[#E3C08D]/90 text-white">
          Reserver nå
        </Button>

        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => onToggleExpand(index)}
            className="flex items-center justify-between w-full text-left focus:outline-none"
            aria-expanded={isExpanded}
          >
            <span className="text-[#E3C08D] font-medium">{isExpanded ? "Vis mindre" : "Mer informasjon"}</span>
            <div className="w-6 h-6 rounded-full bg-[#E3C08D] flex items-center justify-center transition-all duration-200 hover:cursor-pointer">
              {isExpanded ? <Minus className="h-3 w-3 text-white" /> : <Plus className="h-3 w-3 text-white" />}
            </div>
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isExpanded ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
            }`}
          >
            <div className="space-y-3 pt-2">
              {moreInfo.map((info, i) => (
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
  )
}
