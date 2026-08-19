import React from "react"

import { ContactSection } from "../components/contact-section"
import audiImage from "../assets/luxury-audi-sedan-in-modern-setting.jpg"

export default function ArrangementerPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${audiImage})`,
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 text-center text-white max-w-7xl mx-auto px-4 mt-20">
          <h1 className="text-4xl md:text-6xl font-bold text-[#E3C08D] mb-8 text-balance">Events</h1>
          <p className="text-lg md:text-xl leading-relaxed text-pretty">
            Prime Norway offers more than just a car for your transport needs. Our wide range of events ensures
            you have an unforgettable experience. From weddings to corporate events, we have everything organized so
            you can relax and enjoy your event. Our dedicated team, with years of experience in the car rental
            industry, ensures everything runs smoothly. Renting a luxury car from Prime means a worry-free experience.
          </p>
        </div>
      </section>

     <ContactSection />
    </main>
  )
}
