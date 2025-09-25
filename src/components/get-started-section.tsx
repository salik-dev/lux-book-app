import React from "react"
import { Button } from "./ui/button"
import { ArrowRight } from "lucide-react"
import { steps } from "../constants/data"
import { HeroDescription, HeroHeading } from "./common/hero-heading"

export function GetStartedSection() {

  return (
    <section className="py-20 px-4 bg-black">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <HeroHeading title="Kom i gang" />
          <HeroDescription description="Tre enkle steg til din neste luksusopplevelse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="group relative p-8 bg-gray-50 tracking-wide hover:scale-105 hover:cursor-pointer transition-all duration-300 ">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#E3C08D] rounded-full flex items-center justify-center text-black">
                {step.icon}
              </div>
              <div className="text-center pt-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-400 text-sm font-medium">
                {index + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            className="bg-[#E3C08D] text-black hover:bg-[#d4b382] px-8 py-6 text-base font-medium group"
          >
            Start din reise
            <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

      </div>
    </section>
  )
}
