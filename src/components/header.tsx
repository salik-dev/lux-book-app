"use client"

import React, { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { Link, useNavigate } from "react-router-dom"
import logo from "../assets/logo.png"
import { AuthDialog } from "./auth-dialog"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/auth-context"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { t } = useTranslation();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-gray-800"
      style={{ backgroundColor: "#0d1518" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-32">
          <div className='flex items-center gap-10'>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-white">
                <span className="text-[#E3C08D]">
                  <img src={logo} alt="Logo" className='w-32' />
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              {
                !user ? (
                  <>
                    <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Hjem
                    </Link>
                    <Link to="/om-oss" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Om oss
                    </Link>
                    <Link to="/arrangementer" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Arrangementer
                    </Link>
                    <Link to="/galleriet-vart" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Galleriet vårt
                    </Link>
                    <Link to="/vare-bildetaljer" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Våre bildetaljer
                    </Link>
                    <Link to="/kontakt-oss" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Kontakt oss
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Home
                    </Link>
                    <Link to="/booking" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      My Booking
                    </Link>
                    <Link to="/admin" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Dashboard
                    </Link>
                  </>
                )
              }
            </nav>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {
              !user ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-5 text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black bg-transparent transition-colors duration-500 border-[#E3C08D] hover:cursor-pointer"
                  >
                    Ring Oss
                  </Button>
                  <AuthDialog>
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-5 text-black bg-[#E3C08D] hover:bg-white hover:text-black border-[#E3C08D] hover:cursor-pointer transition-colors duration-500"
                    >
                      Logg inn
                    </Button>
                  </AuthDialog>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="px-5 text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black bg-transparent transition-colors duration-500 border-[#E3C08D] hover:cursor-pointer"
                >
                  Logg ut
                </Button>
              )
            }
          </div>

          <button
            className="md:hidden text-white focus:outline-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <nav className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Hjem
              </Link>
              <Link to="/om-oss" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Om oss
              </Link>
              <Link to="/arrangementer" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Arrangementer
              </Link>
              <Link to="/galleriet-vart" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                Galleriet vårt
              </Link>
              <Link
                to="/galleriet-vart"
                className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Galleriet vårt
              </Link>
              <Link
                to="/vare-bildetaljer"
                className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Våre bildetaljer
              </Link>
              <div className="pt-4 flex flex-col space-y-3">
                {
                  !user ? <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#E3C08D] text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black w-full bg-transparent hover:cursor-pointer"
                    >
                      Ring oss
                    </Button>
                    <AuthDialog>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#E3C08D] bg-[#E3C08D] text-black hover:bg-white hover:text-black w-full hover:cursor-pointer"
                      >
                        Logg inn
                      </Button>
                    </AuthDialog>
                  </>
                    : <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                      className="border-[#E3C08D] text-[#E3C08D] hover:bg-[#E3C08D] hover:text-black w-full bg-transparent hover:cursor-pointer"
                    >
                      Logg ut
                    </Button>
                }
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
