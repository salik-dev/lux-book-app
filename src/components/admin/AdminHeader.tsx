"use client"

import React, { useEffect, useState } from "react"
import { Book, BookUserIcon, Filter, LayoutDashboard, Menu, UserIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link, useNavigate } from "react-router-dom"
import logo from "../../assets/logo.png"
import { AuthDialog } from "@/components/auth-dialog"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/auth-context"
import { User, LogOut, ChevronDown } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast";

export function AdminHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const { t } = useTranslation();
    const { toast } = useToast();
    const { user, isAdmin, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {

        await signOut();
        navigate('/');
    };

    const loginItems = [
        { id: 1, title: 'Home', path: '/' },
        { id: 2, title: 'My Booking', path: '/bookings' },
        { id: 3, title: 'Dashboard', path: '/admin' },
        { id: 4, title: 'Profile', path: '/' },
    ];

    // Show welcome toast when user logs in
    useEffect(() => {
        if (user?.id) {
            toast({
                title: 'Success',
                description: 'You are logged in',
            });
        }
    }, [user?.id]);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 bg-gray-50 ${!isMenuOpen && 'border-b border-gray-200'}`}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
                <div className="flex items-center justify-between h-20 md:h-24 lg:h-18">
                    <div className='flex items-center gap-4 md:gap-8 lg:gap-10 min-w-0'>
                        <div className="flex items-center space-x-2">
                            <div className="text-2xl font-bold text-white">
                                <Link to="/" className="text-[#E3C08D]">
                                    <img src={logo} alt="Logo" className='w-20 md:w-24 lg:w-28' />
                                </Link>
                            </div>
                        </div>

                    </div>
                        <nav className="hidden md:flex flex-wrap items-center gap-4 lg:gap-8">
                            <Link to="/" className="font-semibold text-[14px] transition-colors">
                                Home
                            </Link>
                            <Link to="/bookings" className="font-semibold text-[14px] transition-colors">
                                My Booking
                            </Link>
                            {isAdmin && <Link to="/admin" className="font-semibold text-[14px] transition-colors">
                                Dashboard
                            </Link>}
                        </nav>

                    <div className="hidden md:flex items-center gap-2 lg:gap-4 min-w-0">
                        <div className="relative group">
                            <button className="px-4 h-9 text-sm rounded-md text-black font-semibold hover:cursor-pointer transition-colors duration-500 flex items-center gap-2 bg-white">
                                <UserIcon className="h-4 w-4" />
                                <span className="block max-w-[120px] md:max-w-[160px] truncate text-left">{user?.email }</span>
                                <ChevronDown className="h-4 w-4" />
                            </button>
                            <div className="absolute right-0 mt-1 w-58 rounded-md bg-white shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                <div className="py-[6px] flex flex-col">
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
                    </div>

                    <button
                        className="md:hidden hover:cursor-pointer focus:outline-none"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-200 bg-white px-6 pt-2 shadow-xl">
                        <nav className="flex flex-col space-y-3 mt-4">
                            {[
                                { id: 1, title: "Home", path: "/" },
                                { id: 2, title: "My Booking", path: "/bookings" },
                                { id: 3, title: "Dashboard", path: "/admin" },
                            ].map((item) => (
                                <Link
                                    key={item.id}
                                    to={item.path}
                                    className="font-semibold tracking-wide text-[15px] transition-colors hover:text-[#E3C08D] duration-300"
                                >
                                    {item.title}
                                </Link>
                            ))}
                            <div className="pt-4 flex flex-col space-y-3">
                                {
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSignOut}
                                        className="border-[#E3C08D] text-white bg-[#E3C08D] hover:text-black w-full hover:bg-[#E3C08D]/80 hover:cursor-pointer transition-all duration-300"
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
