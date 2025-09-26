import React from "react"
import { Shield, Clock, Award, Headphones, Phone, Calendar, Percent, Car, CreditCard, Mail, MapPin, DollarSign, MessageCircle, Star } from "lucide-react"

import lamborghiniImage from "../assets/luxury-lamborghini-sports-car-in-city.jpg?no-inline"
import audiImage from "../assets/luxury-audi-sedan-in-modern-setting.jpg?no-inline"
import rangeImage from "../assets/luxury-range-rover-suv-in-urban-landscape.jpg?no-inline"
import mercedesImage from "../assets/bmw-x7-luxury-suv-dark-metallic.jpg?no-inline"
import toyotaImage from "../assets/luxury-car-showroom-dark-elegant.jpg?no-inline"
import bentleyImage from "../assets/luxury-bentley-sedan-in-premium-setting.jpg?no-inline"

export const leadingRentalList = [
    {
       id: 1,
       details: 'Prime Norge er blant Norges ledende aktører innen luksusbilutle. Vi tilbyr deg en uforglemmelig kjøreopplevelse med våre premium kjøretøy.' 
    },
    {
        id: 2,
        details: '  Vår flåte består av de nyeste og mest eksklusive bilene på markedet. Fra sportsbiler til luksuriøse sedaner - vi har det perfekte kjøretøyet for enhver anledning.'
    },
    {
        id: 3,
        details: '  Vi har også tilbud på langtidsleie og korttidsleie. Kontakt oss i dag for å få et tilbud som passer dine behov.'
    }
];

export const vehicles = [
    {
      name: "Mercedes Benz G-Wagon",
      image: lamborghiniImage,
      price: "7.990kr",
      vehicleType: "Luksus SUV",
      doors: "4 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Premium lær interiør med oppvarming",
        "Firehjulstrekk system med terrengmodus",
        "Avansert sikkerhetspakke med blindsone-assistanse",
        "Panorama soltak med elektrisk betjening",
        "Harman Kardon premium lydsystem",
        "Adaptiv cruise control",
        "360-graders kamerasystem",
      ],
    },
    {
      name: "BMW i7",
      image: audiImage,
      price: "5.990kr",
      vehicleType: "Luksus Sedan",
      doors: "4 dører, 5 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Elektrisk drivlinje med 500+ km rekkevidde",
        "Executive lounge seter med massasje",
        "Bowers & Wilkins Diamond surround lyd",
        "Luftfjæring med adaptiv demping",
        "BMW Live Cockpit Professional",
        "Wireless charging og WiFi hotspot",
        "Gesture control og voice assistant",
      ],
    },
    {
      name: "Rolls Royce Ghost",
      image: rangeImage,
      price: "9.990kr",
      vehicleType: "Luksus Sedan",
      doors: "4 dører, 4 seter",
      transmission: "Automatisk",
      fuel: "5 dører, 5 seter",
      category: "Automatisk",
      moreInfo: [
        "Håndlaget interiør med finest lær",
        "Whisper quiet kabin med lyddemping",
        "Bespoke audio system med 18 høyttalere",
        "Starlight headliner med 1,340 fiber optikk",
        "Magic carpet ride luftfjæring",
        "Spirit of Ecstasy med belysning",
        "Champagne kjøler og crystal glass",
      ],
    },
  ];

  export  const benefits = [
    {
      icon: Shield,
      title: "Trygghet",
      description: "Alle våre biler er forsikret og gjennomgår regelmessige sikkerhetskontroller",
    },
    {
      icon: Clock,
      title: "24/7 Service",
      description: "Vi er tilgjengelige døgnet rundt for å hjelpe deg med alle dine behov",
    },
    {
      icon: Award,
      title: "Premium kvalitet",
      description: "Kun de beste og nyeste luksusbilene i vår eksklusive flåte",
    },
    {
      icon: Headphones,
      title: "Kundeservice",
      description: "Vårt dedikerte team sørger for en sømløs opplevelse fra start til slutt",
    },
  ];

  export const galleryImages = [
    {
      src: mercedesImage,
      alt: "Mercedes G-Class SUV",
      title: "MERCEDES G-CLASS",
    },
    {
      src: lamborghiniImage,
      alt: "Lamborghini Luxury Sedan",
      title: "LAMBORGHINI LUXURY SEDAN",
    },
    {
      src: toyotaImage,
      alt: "Porsche Sports Car",
      title: "PORSCHE SPORTS CAR",
    },
    {
      src: audiImage,
      alt: "Toyota Land Cruiser",
      title: "TOYOTA LAND CRUISER",
    },
    {
      src: rangeImage,
      alt: "Audi Luxury Sedan",
      title: "AUDI LUXURY SEDAN",
    },
    {
      src: bentleyImage,
      alt: "Range Rover SUV",
      title: "RANGE ROVER SUV",
    },
    {
      src: lamborghiniImage,
      alt: "Bentley Luxury Sedan",
      title: "BENTLEY LUXURY SEDAN",
    },
    {
      src: lamborghiniImage,
      alt: "Lamborghini Sports Car",
      title: "LAMBORGHINI SPORTS CAR",
    },
  ];

  export const discountColumns = [
    {
      icon: React.createElement(Percent, { className: "h-6 w-6 text-black" }),
      title: "15% Off",
      subtitle: "Special Offer",
      description: React.createElement(
        React.Fragment,
        null,
        "Use code: ",
        React.createElement("span", { className: "text-[#E3C08D] font-medium" }, "PRIME15")
      ),
      buttonText: "Claim Offer",
    },
    {
      icon: React.createElement(Phone, { className: "h-6 w-6 text-black" }),
      title: "Call Us",
      subtitle: "Need Help?",
      description: "24/7 Customer Support",
      highlightText: "92 92 07 71",
      additionalInfo: {
        icon: React.createElement(Clock, { className: "h-4 w-4 mr-2" }),
        text: "Available 24/7"
      }
    },
    {
      icon: React.createElement(Calendar, { className: "h-6 w-6 text-black" }),
      title: "Reserve Your Car",
      subtitle: "Book Now",
      description: "Easy online booking system",
      buttonText: "Book Now",
    }
  ];

  export const steps = [
    {
      icon:  React.createElement(Car, { className: "h-6 w-6" }),
      title: "Så enkelt kommer du i gang",
      description: "Velg din drømmebil fra vår eksklusive flåte"
    },
    {
      icon: React.createElement(Calendar, { className: "h-6 w-6" }),
      title: "Reservasjonsprosess",
      description: "Book online eller ring oss for personlig service"
    },
    {
      icon: React.createElement(CreditCard, { className: "h-6 w-6" }),
      title: "Hent og kjør",
      description: "Vi leverer bilen til deg eller du kan hente den hos oss"
    }
  ];

 export const contactInfo = [
    {
      id: 1,
      icon: React.createElement(Mail, { className: "h-4 w-4 text-black" }),
      text: "hei@primebil.no",
      type: "email"
    },
    {
      id: 2,
      icon: React.createElement(Phone, { className: "h-4 w-4 text-black" }),
      text: "92 92 07 71",
      type: "phone"
    },
    {
      id: 3,
      icon: React.createElement(MapPin, { className: "h-4 w-4 text-black" }),
      text: "Tvetenveien 152, 0671 Oslo",
      type: "address"
    }
  ];

  export const benefitsData = [
    {
      id: 1,
      icon: React.createElement(DollarSign, { className: "h-18 w-18 text-[#E3C08D]" }),
      title: "Øyeblikkelig tilbud\npå nett",
      description: "",
      customClass: "mx-auto"
    },
    {
      id: 2,
      icon: React.createElement(Car, { className: "h-18 w-18 text-[#E3C08D]" }),
      title: "Norway's largest fleet",
      description: "",
      customClass: ""
    },
    {
      id: 3,
      icon: React.createElement(MessageCircle, { className: "h-18 w-18 text-[#E3C08D]" }),
      title: "24 timers online",
      description: "support",
      customClass: ""
    },
    {
      id: 4,
      icon: React.createElement(Star, { className: "h-18 w-18 text-[#E3C08D]" }),
      title: "Excellent review",
      description: "",
      customClass: ""
    }
  ];