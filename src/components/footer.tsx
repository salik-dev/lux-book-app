import React from "react"
import { Phone, Mail, MapPin, Clock, Facebook, Twitter, Instagram, Linkedin, Send } from "lucide-react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import logo from "../assets/logo.png"

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-16 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-[#E3C08D] -mt-10">
              <img src={logo} alt="Logo" className='w-32' />         
            </h3>
            
            <div className="flex items-start space-x-4">
              <div className="mt-1">
                <Phone className="h-5 w-5 text-[#E3C08D]" />
              </div>
              <div>
                <h4 className="font-semibold">Telefon</h4>
                <p className="text-gray-400">+47 92 92 07 71</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="mt-1">
                <Mail className="h-5 w-5 text-[#E3C08D]" />
              </div>
              <div>
                <h4 className="font-semibold">E-post</h4>
                <p className="text-gray-400">post@primenorge.no</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="mt-1">
                <MapPin className="h-5 w-5 text-[#E3C08D]" />
              </div>
              <div>
                <h4 className="font-semibold">Adresse</h4>
                <p className="text-gray-400">Heggedalsveien 23, 1389 Heggedal</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="mt-1">
                <Clock className="h-5 w-5 text-[#E3C08D]" />
              </div>
              <div>
                <h4 className="font-semibold">Åpningstider</h4>
                <p className="text-gray-400">Man - Søn: 09:00 - 22:00</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-2xl font-bold text-[#E3C08D] mb-6">Hurtiglenker</h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  Hjem
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  Våre biler
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  Tjenester
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  Om oss
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  Kontakt oss
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-[#E3C08D] mb-6">Nyhetsbrev</h3>
            <p className="text-gray-400 mb-6">
              Meld deg på vårt nyhetsbrev for å motta tilbud og oppdateringer om våre tjenester.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="email"
                placeholder="Din e-postadresse"
                className="bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#E3C08D] focus:border-transparent"
              />
              <Button className="bg-[#E3C08D] text-black hover:bg-[#d4b382] font-medium whitespace-nowrap">
                <Send className="mr-2 h-4 w-4" />
                Abonner
              </Button>
            </div>
            
            <div className="mt-8">
              <h4 className="font-semibold mb-4">Følg oss</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  <Facebook className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  <Twitter className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  <Instagram className="h-6 w-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-[#E3C08D] transition-colors">
                  <Linkedin className="h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
        {/* Bottom Bar */}
        <div className="border-gray-800 mt-6 py-3 w-full bg-[#0d1527]">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex space-x-2 mx-auto">
              <a href="https://absoluit.com" className="text-gray-500 hover:text-[#E3C08D] text-[15px] tracking-wide transition-colors">
                Copyright © 2023 <span className="font-semibold">Absoluit</span>. All Rights Reserved.
              </a>
            </div>
          </div>
        </div>
    </footer>
  )
}
