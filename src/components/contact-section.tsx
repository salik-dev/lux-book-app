import React from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Phone, Mail, MapPin, DollarSign, Car, MessageCircle, Star } from "lucide-react"

export function ContactSection() {
  return (
    <section id="contact" className="bg-white">
      {/* Contact Form Section - Dark Background */}
      <div className="bg-[#0d1518] py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#E3C08D] mb-4 text-balance">Contact us</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Name"
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
                <Input
                  placeholder="Email address"
                  type="email"
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
              </div>
              <Textarea
                placeholder="Message"
                rows={6}
                className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 resize-none"
              />
              <Button size="lg" className="bg-[#E3C08D] text-black hover:bg-[#d4b382] font-semibold px-8 py-3 hover:cursor-pointer">
                SUBMIT
              </Button>
            </div>

            {/* Contact Information */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-[#E3C08D] flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <p className="text-white font-medium">hei@primebil.no</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-[#E3C08D] flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <p className="text-white font-medium">92 92 07 71</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-[#E3C08D] flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Tvetenveien 152, 0671 Oslo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section - White Background */}
      <div className="bg-white py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#E3C08D] flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-black mb-2">Instant</h3>
              <p className="text-black">online quote</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#E3C08D] flex items-center justify-center mx-auto mb-4">
                <Car className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-black mb-2">Norway's largest fleet</h3>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#E3C08D] flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-black mb-2">24 timers online</h3>
              <p className="text-black">support</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-[#E3C08D] flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-black mb-2">Excellent review</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
