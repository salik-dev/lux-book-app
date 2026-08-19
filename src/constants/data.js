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
       details: 'Prime Norway is among Norway\'s leading players in luxury car rental. We offer you an unforgettable driving experience with our premium vehicles.'
    },
    {
        id: 2,
        details: '  Our fleet consists of the newest and most exclusive cars on the market. From sports cars to luxurious sedans - we have the perfect vehicle for every occasion.'
    },
    {
        id: 3,
        details: '  We also offer long-term and short-term rentals. Contact us today to get an offer that suits your needs.'
    }
];

  export  const benefits = [
    {
      icon: Shield,
      title: "Safety",
      description: "All our cars are insured and undergo regular safety inspections",
    },
    {
      icon: Clock,
      title: "24/7 Service",
      description: "We are available around the clock to help you with all your needs",
    },
    {
      icon: Award,
      title: "Premium Quality",
      description: "Only the best and newest luxury cars in our exclusive fleet",
    },
    {
      icon: Headphones,
      title: "Customer Service",
      description: "Our dedicated team ensures a seamless experience from start to finish",
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
      title: "Getting started is this easy",
      description: "Choose your dream car from our exclusive fleet"
    },
    {
      icon: React.createElement(Calendar, { className: "h-6 w-6" }),
      title: "Reservation Process",
      description: "Book online or call us for personal service"
    },
    {
      icon: React.createElement(CreditCard, { className: "h-6 w-6" }),
      title: "Pick Up and Drive",
      description: "We deliver the car to you or you can pick it up from us"
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
      title: "Instant offers\nonline",
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
      title: "24 hours online",
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