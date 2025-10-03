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
      className={`bg-white overflow-hidden shadow-md hover:shadow-xl transition-all duration-300`}
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
        <hr className="border-t border-gray-200 mb-4" />

        <div className="space-y-2 mb-6">
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <HourglassIcon className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>per hour: {base_price_per_hour} pkr</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <CalendarDays className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>per day: {base_price_per_day} pkr</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <LocateFixed className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>{included_km_per_day} km included per day</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-700">
            <LocateFixed className="h-3 w-3 text-[#E3C08D] flex-shrink-0" />
            <span>Extra km: {extra_km_rate} / km</span>
          </div>
        </div>


        <div className="mt-6">
          <Button onClick={handleCarSelect} className="w-full tracking-wide text-black bg-[#E3C08D] hover:bg-[#E3C08D]/90 hover:cursor-pointer transition-all duration-300 hover:text-white">
            Reserver nå
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
              <span className="rounded-full bg-gray-400 p-1">
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
            <div className="pt-2 text-sm tracking-wide text-gray-700">
              {description}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
