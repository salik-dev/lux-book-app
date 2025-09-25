import React from "react";
import { HeroDescription, HeroHeading } from "./common/hero-heading";
import { leadingRentalList } from "../constants/data";

export function LeadingRentalSection() {
  return (
    <section className="px-8 py-28" style={{ backgroundColor: "#000000" }}>
      
      <div className="container mx-auto text-center">
       <HeroHeading title="En av de ledende luksusbilutleiene – de beste tilbudene i Norge" />

        <div className="max-w-4xl mx-auto">
          <HeroDescription description="" />
          {leadingRentalList.map((item) => (
            <HeroDescription key={item.id} description={item.details} />
          ))}
        </div>

      </div>
    </section>
  )
}
