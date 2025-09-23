import React from "react"
import { Button } from "./ui/button"
import { ArrowRight, Car, Calendar, CreditCard } from "lucide-react"

export function GetStartedSection() {
  const steps = [
    {
      icon: <Car className="h-6 w-6" />,
      title: "Så enkelt kommer du i gang",
      description: "Velg din drømmebil fra vår eksklusive flåte"
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Reservasjonsprosess",
      description: "Book online eller ring oss for personlig service"
    },
    {
      icon: <CreditCard className="h-6 w-6" />,
      title: "Hent og kjør",
      description: "Vi leverer bilen til deg eller du kan hente den hos oss"
    }
  ]

  return (
    <section className="py-20 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Kom i gang</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">Tre enkle steg til din neste luksusopplevelse</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, index) => (
            <div key={index} className="group relative p-8 bg-gray-50 rounded-lg transition-all duration-300 hover:shadow-lg">
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
