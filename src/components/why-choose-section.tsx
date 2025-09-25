import React from "react";
import { benefits } from "../constants/data";
import { HeroDescription, HeroHeading } from "./common/hero-heading";

export function WhyChooseSection() {

  return (
    <section className="py-24 px-4 tracking-wide" style={{ backgroundColor: "#000000" }}>
      <div className="container mx-auto">
        
        <div className="text-center mb-12">
          <HeroHeading title="Hvorfor velge Prime Norge?" />
          <HeroDescription description="Vi skiller oss ut med vår eksepsjonelle service og premium kjøretøy" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center group hover:transform hover:scale-105 transition-all duration-300">
              <div className="bg-[#e3c08d] w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#e3c08d]/90 transition-colors rounded-full">
                <benefit.icon className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-gray-400 text-sm">{benefit.description}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}