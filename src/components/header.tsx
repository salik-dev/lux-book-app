"use client"

import React, { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { Link } from "react-router-dom"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-gray-800"
      style={{ backgroundColor: "#0d1518" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-around h-32 max-[1040px]:justify-between">
          <div className='flex gap-10 max-[1040px]:gap-6'>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-white">
              <span className="text-[#E3C08D]"><img src='/logo.png' alt="Logo" className='w-32' /></span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
          <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
              Hjem
            </Link>
            <Link to="/om-oss" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
            Om oss
            </Link>
            <Link to="/arrangementer" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
            Arrangementer
            </Link>
            <Link to="/galleriet-vart" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
            Galleriet vårt
            </Link>
            <Link to="/vare-bildetaljer" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
            Våre bildetaljer
            </Link>
            <Link to="/kontakt-oss" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
            Kontakt oss
            </Link>
          </nav>
          </div>

          <div className="hidden md:flex items-center space-x-4 align-center">
            <Button
              variant="outline"
              size="sm"
              className="px-5 pb-[2px] text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black bg-transparent transition-colors hover:cursor-pointer"
            >
              Ring oss
            </Button>
          </div>

          <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <nav className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Hjem
              </Link>
              <Link to="/fleet" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Bil flåte
              </Link>
              <Link to="/services" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Luksusbilutle
              </Link>
              <Link to="/about" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Bilutleie Oslo
              </Link>
              <Link to="/contact" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Kontakt oss
              </Link>
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#E3C08D] text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black hover:cursor-pointer w-full bg-transparent"
                >
                  Ring oss
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
