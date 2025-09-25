import React from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { HeroHeading } from './common/hero-heading'
import { contactInfo } from "../constants/data"
import { benefitsData } from "../constants/data"

export function ContactSection() {
  return (
    <section id="contact" className="bg-white">
      <div className="bg-[#0d1518] py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <HeroHeading title="Kontakt oss" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <form className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Name"
                  required
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
                <Input
                  placeholder="Email address"
                  type="email"
                  required
                  className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 h-12"
                />
              </div>
              <Textarea
                placeholder="Message"
                rows={6}
                required
                className="bg-gray-200 border-gray-300 text-black placeholder:text-gray-500 resize-none"
              />
              <Button size="lg" className="bg-[#E3C08D] text-black hover:bg-[#d4b382] font-semibold px-8 py-3 hover:cursor-pointer">
                SUBMIT
              </Button>
            </form>

            <div className="space-y-8">
              <div className="space-y-6">
                {contactInfo.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#E3C08D] flex items-center justify-center flex-shrink-0 rounded-full">
                      {contact.icon}
                    </div>
                    <div>
                      <p className="text-white font-medium text-lg tracking-wide">{contact.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Section - White Background */}
      <div className="bg-white py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 px-32 max-[1028px]:px-4">
            {benefitsData.map((benefit) => (
              <div key={benefit.id} className={`text-center ${benefit.customClass}`}>
                <div className={`${benefit.customClass ? '' : 'w-16 h-16 flex items-center justify-center mx-auto mb-4'}`}>
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-black mb-2 tracking-wide whitespace-pre-line">
                  {benefit.title}
                </h3>
                {benefit.description && <p className="text-black">{benefit.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </section>
  )
}
