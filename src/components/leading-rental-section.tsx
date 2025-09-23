import React from "react";

export function LeadingRentalSection() {
  return (
    <section className="px-8 py-28" style={{ backgroundColor: "#000000" }}>
      <div className="container mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-[#E3C08D] mb-8">
          En av de ledende luksusbilutleiene – de beste tilbudene i Norge
        </h2>

        <div className="max-w-4xl mx-auto">
          <p className="text-gray-300 text-[20px] mb-6">
            Prime Norge er blant Norges ledende aktører innen luksusbilutle. Vi tilbyr deg en uforglemmelig
            kjøreopplevelse med våre premium kjøretøy.
          </p>

          <p className="text-gray-300 text-[20px] mb-6">
            Vår flåte består av de nyeste og mest eksklusive bilene på markedet. Fra sportsbiler til luksuriøse sedaner
            - vi har det perfekte kjøretøyet for enhver anledning.
          </p>

          <p className="text-gray-300 text-[20px] mb-6">
            Vi har også tilbud på langtidsleie og korttidsleie. Kontakt oss i dag for å få et tilbud som passer dine
            behov.
          </p>
        </div>
      </div>
    </section>
  )
}
