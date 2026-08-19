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
            alt="Luxurious car exhibition"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-[#E3C08D] px-4 max-w-4xl mx-52 max-[1024px]:mx-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">About Us</h1>
          <p className="text-xl md:text-2xl mb-8">
            Your trusted partner for premium car rental in Norway
          </p>
          <Button
            className="border border-[#E3C08D] hover:bg-[#E3C08D]/90 text-[#E3C08D] hover:text-white text-lg px-8 py-6 tracking-wide hover:cursor-pointer"
          >
            Contact Us
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-4 md:px-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#E3C08D] mb-4">
              Our History
            </h2>
            <div className="w-24 h-1 bg-[#E3C08D] mb-8"></div>
            <p className="text-lg text-[#fffffd] tracking-wide max-w-4xl leading-relaxed">
              Prime Norway is a leading Norwegian car rental company with over 15 years of experience in the
              industry. Our passion for cars and business philosophy of customer satisfaction have made us
              a trusted partner for both private individuals and businesses across the country.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-[#E3C08D] mb-6">Our Vision</h3>
              <p className="text-[#fffffd] tracking-wide mb-6 leading-relaxed">
                To deliver a seamless and memorable car rental experience that exceeds our customers' expectations.
                We believe in long-term partnerships and are committed to delivering quality and service without compromise.
              </p>
              <h3 className="text-2xl font-bold text-[#E3C08D] mb-6 mt-10">Our Values</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Customer satisfaction is our highest priority</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Honesty and transparency in everything we do</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-[#E3C08D] p-1 mt-1 mr-4 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xl text-[#fffffd] tracking-wide">Continuous improvement and innovation</span>
                </li>
                <Button className="border border-[#E3C08D] uppercase bg-[#E3C08D]/90 text-bold hover:text-white text-md px-8 py-6 hover:cursor-pointer mt-8">
                  Reserve a car
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </ul>
            </div>
            <div className="relative h-96 md:h-[500px] overflow-hidden shadow-xl">
              <img
                src={audiImage}
                alt="Our showroom"
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