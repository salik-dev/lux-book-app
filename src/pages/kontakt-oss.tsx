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
      title: 'What does it cost to rent a luxury car from PRIME?',
      answer: 'To rent a luxury car from PRIME, you must meet the following requirements: Age: Minimum 25 years for most luxury and sports cars. Rentals to persons over 21 years old are possible, but a 3-year valid driving license may be required.'
    },
    {
      id: 2,
      title: 'How far in advance should I reserve a luxury car?',
      answer: 'To ensure availability and get the best experience with our luxury cars, we recommend reserving 5-10 days in advance. This gives us the opportunity to prepare everything for your arrival.'
    },
    {
      id: 3,
      title: 'Can I rent a luxury car the same day I book?',
      answer: 'Yes, it is possible to rent a car the same day, but we recommend booking in advance to ensure availability. Contact us directly to check available cars on short notice.'
    },
    {
      id: 4,
      title: 'How many luxury cars are available at PRIME?',
      answer: 'We have a wide selection of over 20 luxury cars in our fleet, including Mercedes, BMW, Audi and Porsche. Our selection varies, so contact us to hear about available cars for your desired period.'
    }
  ]
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-[100vh] flex items-center aligns-center justify-center overflow-hidden bg-gray-100">
        <div className="absolute inset-0">
          <img
            src={lamborghiniImage}
            alt="Luxurious showroom"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto flex flex-col items-center gap-6">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-[#E3C08D]">We're open 24/7</h1>
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
            Book your car now
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 md:px-8 bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-wider mb-12 text-[#E3C08D]">Frequently Asked Questions</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {faqsList.map((faq) => (
              <div key={faq.id} className="bg-white p-8 shadow-lg border border-gray-100 text-center">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-[#E3C08D] text-white w-4 h-4 flex items-center justify-center flex-shrink-0 mt-1 rounded-md">
                    <span className="text-sm">?</span>
                </div>
                <h3 className="text-xl font-semibold text-[#E3C08D]">
                  What does it cost to rent a luxury car from PRIME?
                </h3>
              </div>
              <p className="text-gray-600 pl-12">
                To rent a luxury car from PRIME, you must meet the following requirements: Age: Minimum 25 years for
                most luxury and sports cars. Rentals to persons over 21 years old are possible, but a 3-year valid
                driving license may be required.
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