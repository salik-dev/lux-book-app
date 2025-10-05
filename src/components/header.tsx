"use client"

import React, { useEffect, useState } from "react"
import { Book, BookUserIcon, Filter, LayoutDashboard, Menu, X } from "lucide-react"
import { Button } from "./ui/button"
import { Link, useNavigate } from "react-router-dom"
import logo from "../assets/logo.png"
import { AuthDialog } from "./auth-dialog"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/auth-context"
import { User, LogOut, ChevronDown } from "lucide-react"
import { Separator } from "./ui/separator"
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {

    await signOut();
    navigate('/');
  };

  const homeItems = [
    { id: 1, title: "Hjem", path: "/" },
    { id: 2, title: "Om oss", path: "/om-oss" },
    { id: 3, title: "Arrangementer", path: "/arrangementer" },
    { id: 4, title: "Galleriet vårt", path: "/galleriet-vart" },
    { id: 5, title: "Våre bildetaljer", path: "/vare-bildetaljer" },
    { id: 6, title: "Kontakt oss", path: "/kontakt-oss" },
  ];

  const loginItems = [
    { id: 1, title: 'Home', path: '/' },
    { id: 2, title: 'My Booking', path: '/bookings' },
    { id: 3, title: 'Dashboard', path: '/admin' },
    { id: 4, title: 'Profile', path: '/' },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-gray-800"
      style={{ backgroundColor: "#0d1518" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-32">
        <div className="flex items-center justify-between h-20 md:h-24 lg:h-28">
          <div className='flex items-center gap-4 md:gap-8 lg:gap-10 min-w-0'>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-white">
                <Link to="/" className="text-[#E3C08D]">
                  <img src={logo} alt="Logo" className='w-24 md:w-28 lg:w-32' />
                </Link>
              </div>
            </div>

            <nav className="hidden md:flex flex-wrap items-center gap-4 lg:gap-8">
              {
                !user ? (
                  homeItems.map((item) => (
                    <Link key={item.id} to={item.path} className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      {item.title}
                    </Link>
                  ))
                ) : (
                  <>
                    <Link to="/" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Home
                    </Link>
                    <Link to="/bookings" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      My Booking
                    </Link>
                    {isAdmin && <Link to="/admin" className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors">
                      Dashboard
                    </Link>}
                  </>
                )
              }
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2 lg:gap-4 min-w-0">
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
                <div className="relative group borde">
                  <button className="px-4 h-9 text-sm rounded-md text-black bg-[#E3C08D] hover:bg-white hover:cursor-pointer hover:text-black transition-colors duration-500 flex items-center gap-1">
                    <span className="block max-w-[120px] md:max-w-[160px] truncate text-left">{user.email}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </button>
                  <div className="absolute right-0 mt-1 w-50 rounded-md bg-white shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 borde">
                    <div className="py-1 flex flex-col">
                      {loginItems.slice(1).map((item) => (
                        <Link
                          key={item.id}
                          to={item.path}
                          className="flex items-center align-middle w-44 mx-auto gap-2 px-4 py-[6px] mt-1 rounded-md text-sm text-gray-700 hover:bg-[#E3C08D] hover:text-white transition-all duration-300 hover:cursor-pointer"
                        >
                          {{
                            'My Booking': <BookUserIcon className="h-3 w-3" />,
                            'Dashboard': <LayoutDashboard className="h-3 w-3" />,
                            'Profile': <User className="h-3 w-3" />
                          }[item.title] || null}
                          <span className="relative -top-[0.6px] text-[14px] tracking-wide">{item.title}</span>
                        </Link>
                      ))}

                      <Separator className="border mt-2" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center align-middle w-44 mx-auto gap-2 px-4 py-[6px] mt-1 rounded-md text-sm text-gray-800 hover:bg-[#E3C08D] hover:text-white transition-all duration-300 hover:cursor-pointer">
                        <LogOut className="h-3 w-3" /><span className="relative -top-[0.6px] text-[14px] tracking-wide">Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>
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
              {user === null ? homeItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors"
                >
                  {item.title}
                </Link>
              )) : loginItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className="text-gray-300 hover:text-[#e3c08d] tracking-wide text-[15px] transition-colors"
                >
                  {item.title}
                </Link>
              ))}
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
