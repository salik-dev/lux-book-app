import React from "react"
import { Button } from "./ui/button"
import { Phone, Calendar, Percent, Clock } from "lucide-react"

export function DiscountSection() {
  return (
    <section className="py-16 px-4 bg-black">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* First Column - Discount */}
          <div className="bg-white p-8 border border-gray-200 hover:border-[#E3C08D] hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-[#E3C08D] p-3 rounded-full mr-4">
                  <Percent className="h-6 w-6 text-black" />
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Special Offer</p>
                  <h3 className="text-2xl font-bold text-gray-900">15% Off</h3>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6">Use code: <span className="text-[#E3C08D] font-medium">PRIME15</span></p>
            <Button className="w-full bg-[#E3C08D] text-black hover:bg-[#d4b382] font-medium">
              Claim Offer
            </Button>
          </div>

          {/* Second Column - Contact */}
          <div className="bg-white p-8 border border-gray-200 hover:border-[#E3C08D] hover:shadow-lg transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="bg-[#E3C08D] p-3 rounded-full mr-4">
                <Phone className="h-6 w-6 text-black" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Need Help?</p>
                <h3 className="text-2xl font-bold text-gray-900">Call Us</h3>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-2">24/7 Customer Support</p>
            <p className="text-[#E3C08D] text-xl font-bold mb-6">92 92 07 71</p>
            <div className="flex items-center text-gray-600 text-sm">
              <Clock className="h-4 w-4 mr-2" />
              <span>Available 24/7</span>
            </div>
          </div>

          {/* Third Column - Booking */}
          <div className="bg-white p-8 border border-gray-200 hover:border-[#E3C08D] hover:shadow-lg transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="bg-[#E3C08D] p-3 rounded-full mr-4">
                <Calendar className="h-6 w-6 text-black" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Book Now</p>
                <h3 className="text-2xl font-bold text-gray-900">Reserve Your Car</h3>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6">Easy online booking system</p>
            <Button className="w-full bg-[#E3C08D] text-black hover:bg-[#d4b382] font-medium">
              Book Now
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
