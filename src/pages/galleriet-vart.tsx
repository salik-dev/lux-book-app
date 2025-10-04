import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import porscheImage from "@/assets/luxury-porsche-sports-car-in-urban-environment.jpg"
import toyotaImage from "@/assets/luxury-toyota-land-cruiser-suv-in-city.jpg"
import audiImage from "@/assets/luxury-audi-sedan-in-modern-setting.jpg"
import rangeImage from "@/assets/luxury-range-rover-suv-in-urban-landscape.jpg"
import mercedesImage from "@/assets/luxury-porsche-sports-car-in-urban-environment.jpg"
import { CarCardProps } from "@/@types/data"
import { Pagination } from "@/components/ui/pagination"
import { useCarFetch } from "@/hooks/use-car-fetch"
import { CarLoader } from "@/components/common/car-loader"

export default function GallerietVartPage() {
  const [cars, setCars] = useState<CarCardProps[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState("ALLE BILER")
  const imagesPerPage = 8

  // Fetch cars data
  useEffect(() => {
    const fetchCars = async () => {
      try {
        await useCarFetch(setCars, setLoading)
      } catch (error) {
        console.error('Error fetching cars:', error)
        setLoading(false)
      }
    }

    fetchCars()
  }, [])

  // Filter cars based on active filter
  const filteredCars = activeFilter === "ALLE BILER" 
    ? cars 
    : cars.filter(car => car.name.includes(activeFilter))

  // Navigation functions for the image modal
  const nextImage = useCallback(() => {
    if (selectedImage === null) return
    setSelectedImage(prev => 
      prev === filteredCars.length - 1 ? 0 : (prev || 0) + 1
    )
  }, [selectedImage, filteredCars.length])

  const prevImage = useCallback(() => {
    if (selectedImage === null) return
    setSelectedImage(prev => 
      prev === 0 ? filteredCars.length - 1 : (prev || 0) - 1
    )
  }, [selectedImage, filteredCars.length])

  // Calculate pagination
  const totalPages = Math.ceil(filteredCars.length / imagesPerPage)
  const currentCars = filteredCars.slice(
    (currentPage - 1) * imagesPerPage,
    currentPage * imagesPerPage
  )

  return (
    <div className="min-h-screen bg-[#0d1518] text-white">
      {/* Hero Section */}
      <section 
        className="relative h-[80vh] flex items-center justify-center bg-cover bg-center" 
        style={{ backgroundImage: `url(${rangeImage})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center p-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">VÅRT GALLERI</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto">
            Utforsk vårt eksklusive utvalg av luksusbiler
          </p>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          {/* Filter Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {["ALLE BILER", "AUDI", "BMW", "MERCEDES", "PORSCHE"].map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "default" : "outline"}
                className={`rounded-none px-8 py-4 text-sm md:text-base ${
                  activeFilter === filter
                    ? "bg-[#E3C08D] border-[#E3C08D] text-black hover:bg-[#E3C08D]/90"
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

          {loading && <CarLoader />}

          {/* Cars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12 xl:px-24">
            {!loading && currentCars.map((car, index) => (
              <div 
                key={car.id}
                className="relative group cursor-pointer"
                onClick={() => setSelectedImage((currentPage - 1) * imagesPerPage + index)}
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={car.image_url || mercedesImage}
                    alt={car.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-white font-bold text-lg">{car.name}</h3>
                  <p className="text-[#E3C08D]">{car.base_price_per_day} / døgn</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </section>

      {/* Image Modal */}
      {selectedImage !== null && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
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
                src={filteredCars[selectedImage]?.image_url || mercedesImage}
                alt={filteredCars[selectedImage]?.name}
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
                {filteredCars[selectedImage]?.name}
              </h3>
              <p className="text-[#E3C08D] text-xl font-medium mb-4">
                {filteredCars[selectedImage]?.base_price_per_day} / døgn
              </p>
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
                    src={car.image_url || mercedesImage}
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