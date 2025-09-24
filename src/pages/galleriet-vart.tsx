import React, { useState } from "react"
import { Button } from "../components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

export default function GallerietVartPage() {
  const [activeFilter, setActiveFilter] = useState("ALLE BILER")
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const imagesPerPage = 8

  const filters = [
    "ALLE BILER",
    "AUDI RS6",
    "BMW 5-SERIE",
    "BMW I7",
    "MERCEDES BENZ C63S",
    "MERCEDES BENZ E COUPE",
    "MERCEDES BENZ EQC",
    "MERCEDES BENZ C-WAGON",
    "PORSCHE TAYCAN",
    "TOYOTA LAND CRUISER",
    "ROLLS ROYCE GHOST",
  ]

  const cars = [
    {
      id: 1,
      name: "MERCEDES G-CLASS",
      price: "8.500,-",
      image: "/luxury-mercedes-g-class-suv-in-urban-setting.jpg",
      details: ["Automatgir", "5 seter", "5 dører", "Bensin", "2023 modell", "4x4"]
    },
    {
      id: 2,
      name: "BMW 7-SERIE",
      price: "6.900,-",
      image: "/luxury-bmw-sedan-in-city-street.jpg",
      details: ["Automatgir", "5 seter", "4 dører", "Hybrid", "2023 modell", "Luxury Package"]
    },
    {
      id: 3,
      name: "PORSCHE 911 TURBO S",
      price: "12.500,-",
      image: "/luxury-porsche-sports-car-in-urban-environment.jpg",
      details: ["Automatgir", "2+2 seter", "2 dører", "Bensin", "2023 modell", "Sport Chrono"]
    },
    {
      id: 4,
      name: "TOYOTA LAND CRUISER",
      price: "7.200,-",
      image: "/luxury-toyota-land-cruiser-suv-in-city.jpg",
      details: ["Automatgir", "7 seter", "5 dører", "Diesel", "2023 modell", "4x4", "Luftfjæring"]
    },
    {
      id: 5,
      name: "AUDI A8 L",
      price: "7.800,-",
      image: "/luxury-audi-sedan-in-modern-setting.jpg",
      details: ["Automatgir", "4 seter", "4 dører", "Hybrid", "2023 modell", "Lang akselavstand"]
    },
    {
      id: 6,
      name: "RANGE ROVER SPORT",
      price: "9.500,-",
      image: "/luxury-range-rover-suv-in-urban-landscape.jpg",
      details: ["Automatgir", "5 seter", "5 dører", "Diesel", "2023 modell", "Terrain Response"]
    }
  ]

  const filteredCars = activeFilter === "ALLE BILER" 
    ? cars 
    : cars.filter(car => car.name.includes(activeFilter))

  const totalPages = Math.ceil(filteredCars.length / imagesPerPage)
  const currentCars = filteredCars.slice(
    (currentPage - 1) * imagesPerPage,
    currentPage * imagesPerPage
  )

  const nextImage = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage + 1) % filteredCars.length)
    }
  }

  const prevImage = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === 0 ? filteredCars.length - 1 : selectedImage - 1)
    }
  }

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1518] text-white">
      
       {/* Hero Section */}
       <section className="relative h-[80vh] flex items-center justify-center bg-cover bg-center" 
        style={{ backgroundImage: "url('/luxury-audi-sedan-in-modern-setting.jpg')" }}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">VÅRT GALLERI</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Utforsk vårt imponerende utvalg av luksusbiler
          </p>
        </div>
      </section>

     <div className="border mx-12 my-8 bg-white mb-0">
      {/* Filter Section */}
      <section className="py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "default" : "outline"}
                className={`rounded-none px-8 py-4 text-sm md:text-base text-[#E3C08D] hover:text-[#E3C08D] ${
                  activeFilter === filter 
                    ? " bg-[#E3C08D] border-[#E3C08D] text-black hover:bg-[#E3C08D]/90" 
                    : "bg-gray-800 text-[#E3C08D] hover:bg-[#E3C08D] hover:text-white"
                }`}
                onClick={() => {
                  setActiveFilter(filter)
                  setCurrentPage(1)
                }}
              >
                {filter}
              </Button>
            ))}
          </div>

          {/* Cars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {currentCars.map((car, index) => (
              <div 
                key={car.id}
                className="relative group cursor-pointer"
                onClick={() => setSelectedImage((currentPage - 1) * imagesPerPage + index)}
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={car.image}
                    alt={car.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-white font-bold text-lg">{car.name}</h3>
                  <p className="text-[#E3C08D]">{car.price} / døgn</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                onClick={prevPage}
                disabled={currentPage === 1}
                variant="outline"
                className="text-white border-gray-600 hover:bg-gray-800 hover:border-gray-500"
              >
                Forrige
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  variant={currentPage === page ? "default" : "outline"}
                  className={`${
                    currentPage === page 
                      ? "bg-[#E3C08D] border-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
                      : "text-white border-gray-600 hover:bg-gray-800 hover:border-gray-500"
                  }`}
                >
                  {page}
                </Button>
              ))}
              <Button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                variant="outline"
                className="text-white border-gray-600 hover:bg-gray-800 hover:border-gray-500"
              >
                Neste
              </Button>
            </div>
          )}
        </div>
      </section>
     </div>

      {/* Image Modal */}
      {selectedImage !== null && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            {/* Close button */}
            <Button
              onClick={() => setSelectedImage(null)}
              variant="outline"
              className="absolute -top-4 right-0 z-10 text-white hover:text-[#E3C08D] transition-colors border-0 hover:bg-transparent hover:cursor-pointer"
              size="icon"
            >
              <X size={24} />
            </Button>

            {/* Main image */}
            <div className="relative">
              <img
                src={filteredCars[selectedImage].image}
                alt={filteredCars[selectedImage].name}
                className="w-full h-auto max-h-[60vh] object-contain"
              />

              {/* Navigation arrows */}
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
                variant="outline"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white border hover:cursor-pointer hover:text-[#E3C08D] transition-colors bg-black/50 hover:bg-black/70"
                size="icon"
              >
                <ChevronLeft size={32} />
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                variant="outline"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:cursor-pointer border hover:border-[#E3C08D] hover:text-[#E3C08D] transition-colors bg-black/50 hover:bg-black/70"
                size="icon"
              >
                <ChevronRight size={32} />
              </Button>
            </div>

            {/* Image info */}
            <div className="text-center mt-6">
              <h3 className="text-white text-2xl font-bold mb-2">
                {filteredCars[selectedImage].name}
              </h3>
              <p className="text-[#E3C08D] text-xl font-medium mb-4">
                {filteredCars[selectedImage].price} / døgn
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {filteredCars[selectedImage].details.map((detail, i) => (
                  <span 
                    key={i} 
                    className="bg-[#2a363b] text-white px-3 py-1 rounded-full text-sm"
                  >
                    {detail}
                  </span>
                ))}
              </div>
            </div>

            {/* Thumbnail navigation */}
            <div className="flex justify-center gap-2 mt-8 overflow-x-auto pb-4">
              {filteredCars.map((car, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedImage(index)
                  }}
                  className={`w-16 h-16 flex-shrink-0 overflow-hidden rounded-md transition-opacity ${
                    index === selectedImage ? 'ring-2 ring-[#E3C08D]' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={car.image}
                    alt={car.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}