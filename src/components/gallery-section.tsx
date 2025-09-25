import React, { useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "./ui/button"
import { galleryImages } from "../constants/data"
import { HeroHeading } from "./common/hero-heading"

export function GallerySection() {

  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const imagesPerPage = 4
  const totalPages = Math.ceil(galleryImages.length / imagesPerPage)

  const getCurrentImages = () => {
    const startIndex = (currentPage - 1) * imagesPerPage
    return galleryImages.slice(startIndex, startIndex + imagesPerPage)
  }

  const nextImage = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage + 1) % galleryImages.length)
    }
  }

  const prevImage = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === 0 ? galleryImages.length - 1 : selectedImage - 1)
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
    <>
      <section className="px-20 py-20 bg-[#0d1518] max-[550px]:px-0">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
           <HeroHeading title="Galleriet vårt" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {getCurrentImages().map((image, index) => {
              const actualIndex = (currentPage - 1) * imagesPerPage + index
              return (
                <div
                  key={actualIndex}
                  className="relative overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedImage(actualIndex)}
                >
                  <img
                    src={image.src || "/placeholder.svg"}
                    alt={image.alt}
                    className="w-full h-64 object-cover  transition-all duration-300 ease-in-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />
                </div>
              )
            })}
          </div>
          <hr className="border-t border-gray-200 mb-4" />

          <div className="flex justify-end items-center gap-4">
            {currentPage > 1 && (
              <Button
                onClick={prevPage}
                variant="outline"
                className="text-gray-400 hover:text-[#E3C08D] transition-colors bg-transparent hover:bg-transparent hover:cursor-pointer"
              >
                Prev
              </Button>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                onClick={() => setCurrentPage(page)}
                variant="outline"
                className={`w-8 h-8 transition-colors ${
                  currentPage === page ? "bg-[#E3C08D] text-black" : "text-gray-400 hover:text-[#E3C08D] hover:bg-transparent hover:cursor-pointer"
                }`}
              >
                {page}
              </Button>
            ))}
            {currentPage < totalPages && (
              <Button
                onClick={nextPage}
                variant="outline"
                className="text-gray-400 hover:text-[#E3C08D] transition-colors bg-transparent hover:bg-transparent hover:cursor-pointer"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </section>

      {selectedImage !== null && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            {/* Close button */}
            <Button
              onClick={() => setSelectedImage(null)}
              variant="outline"
              className="absolute top-4 right-4 z-10 text-white hover:text-[#E3C08D] transition-colors"
            >
              <X size={32} />
            </Button>

            {/* Main image */}
            <div className="relative">
              <img
                src={galleryImages[selectedImage].src || "/placeholder.svg"}
                alt={galleryImages[selectedImage].alt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />

              {/* Navigation arrows */}
              <Button
                onClick={prevImage}
                variant="outline"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-[#E3C08D] transition-colors bg-transparent hover:bg-transparent hover:cursor-pointer"
              >
                <ChevronLeft size={48} />
              </Button>
              <Button
                onClick={nextImage}
                variant="outline"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-[#E3C08D] transition-colors bg-transparent hover:bg-transparent hover:cursor-pointer"
              >
                <ChevronRight size={48} />
              </Button>
            </div>

            {/* Image info */}
            <div className="text-center mt-4">
              <h3 className="text-white text-lg font-semibold">{galleryImages[selectedImage].title}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {selectedImage + 1} of {galleryImages.length}
              </p>
            </div>

            {/* Thumbnail navigation */}
            <div className="flex justify-center gap-2 mt-6 overflow-x-auto pb-2">
              {galleryImages.map((image, index) => (
                <Button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  variant="outline"
                  className={`flex-shrink-0 w-16 h-12 overflow-hidden border-2 transition-colors ${
                    selectedImage === index ? "border-[#E3C08D]" : "border-transparent hover:border-gray-400"
                  }`}
                >
                  <img src={image.src || "/placeholder.svg"} alt={image.alt} className="w-full h-full object-cover" />
                </Button>
              ))}
            </div>

            {/* Pagination in modal */}
            <div className="flex justify-center items-center gap-4 mt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  onClick={() => {
                    setCurrentPage(page)
                    setSelectedImage(null)
                  }}
                  variant="outline"
                  className={`w-8 h-8 transition-colors ${
                    Math.ceil((selectedImage + 1) / imagesPerPage) === page
                      ? "bg-[#E3C08D] text-black"
                      : "text-gray-400 hover:text-[#E3C08D]"
                  }`}
                >
                  {page}
                </Button>
              ))}
              <span className="text-gray-400 ml-2">Next</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
