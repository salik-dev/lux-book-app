import React from "react"
import { Button } from "./ui/button"
import { discountColumns } from "../constants/data"

export function DiscountSection() {
  return (
    <section className="py-16 px-4 bg-black">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {discountColumns.map((column, index) => (
            <div 
              key={index}
              className="bg-white p-8 border border-gray-200 hover:border-[#E3C08D] hover:shadow-lg transition-all duration-300"
            >
              <div className={`flex items-center ${column.additionalInfo ? 'justify-between' : ''} mb-6`}>
                <div className="flex items-center">
                  <div className="bg-[#E3C08D] p-3 rounded-full mr-4">
                    {column.icon}
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">{column.subtitle}</p>
                    <h3 className="text-2xl font-bold text-gray-900">{column.title}</h3>
                  </div>
                </div>
              </div>
              
              {typeof column.description === 'string' ? (
                <p className="text-gray-600 text-sm mb-2">{column.description}</p>
              ) : (
                <p className="text-gray-600 text-sm mb-6">{column.description}</p>
              )}
              
              {column.highlightText && (
                <p className="text-[#E3C08D] text-xl font-bold mb-6">{column.highlightText}</p>
              )}
              
              {column.additionalInfo && (
                <div className="flex items-center text-gray-600 text-sm">
                  {column.additionalInfo.icon}
                  <span>{column.additionalInfo.text}</span>
                </div>
              )}
              
              {column.buttonText && (
                <Button className="w-full bg-[#E3C08D] text-black hover:bg-[#d4b382] font-medium hover:cursor-pointer mt-4">
                  {column.buttonText}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
