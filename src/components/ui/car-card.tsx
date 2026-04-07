"use client"
import React, { useState } from "react"
import { Key, Users, Settings, Plus, Minus, Hourglass, HourglassIcon, CalendarDays, LocateFixed } from "lucide-react"
import { Button } from "./button"
import { CarCardProps } from "../../@types/data"
import defaultImg from '../../assets/luxury-car-showroom-dark-elegant.jpg'

export function CarCard({ id, name='Luksusbil', image_url, description, base_price_per_day, base_price_per_hour, included_km_per_day, extra_km_rate, is_available, onNavigateToBooking, onCarSelect }: CarCardProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false)
    
  const handleCarSelect = () => {
    onCarSelect({
      id,
      name,
      image_url,
      base_price_per_day,
      base_price_per_hour,
      included_km_per_day,
      extra_km_rate,
      is_available,
      description
    })
    onNavigateToBooking()
  }

  return (
    <div
      className="overflow-hidden border border-[#2a2f31] bg-[#232e33] text-[#F5F5F4] shadow-md transition-all duration-300 hover:shadow-xl"
    >
      <div className="relative">
        <img
          src={image_url || defaultImg}
          alt={name}
          className={`w-full h-60 object-cover transition-all duration-300 `}
        />
      </div>

      <div className="p-6">
        <h3 className="text-xl font-semibold text-[#E3C08D] mb-2">{name}</h3>
        <hr className="mb-4 border-t border-[#2a2f31]" />

        <div className="space-y-2 mb-6">
          <div className="flex items-center space-x-3 text-sm text-[#D6D3D1]">
            <HourglassIcon className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>per hour: {base_price_per_hour} pkr</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-[#D6D3D1]">
            <CalendarDays className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>per day: {base_price_per_day} pkr</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-[#D6D3D1]">
            <LocateFixed className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>{included_km_per_day} km included per day</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-[#D6D3D1]">
            <LocateFixed className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>Extra km: {extra_km_rate} / km</span>
          </div>
        </div>

        <div className="mt-6">
          <Button disabled={!is_available} onClick={handleCarSelect} className="w-full tracking-wide text-black bg-[#E3C08D] hover:bg-[#E3C08D]/90 hover:cursor-pointer transition-all duration-300 hover:text-white">
            {is_available ? 'Reserver nå' : 'Bilen er utilgjengelig'}
          </Button>
        </div>
        {/* Mer informasjon - expandable section at bottom */}
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={isInfoOpen}
            onClick={() => setIsInfoOpen((v) => !v)}
            className="w-full flex items-center justify-between py-3 hover:cursor-pointer"
          >
            <span className="font-semibold text-lg text-[#E3C08D]">Mer informasjon</span>
            {isInfoOpen ? (
              <span className="rounded-full bg-[#2a2f31] p-1">
              <Minus className="h-3 w-3 text-white" />
            </span>
            ) : (
              <span className="rounded-full bg-[#E3C08D] p-1">
              <Plus className="h-3 w-3 text-white" />
            </span>
            )}
          </button>
          <div
            className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
              isInfoOpen ? 'max-h-40' : 'max-h-0'
            }`}
          >
            <div className="pt-2 text-sm tracking-wide text-[#D6D3D1]">
              {description}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
