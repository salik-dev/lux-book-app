import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, ChevronDown, BookUserIcon, LayoutDashboard, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

const accountItems = [
  { title: 'My Booking', path: '/bookings', icon: BookUserIcon },
  { title: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { title: 'Profile', path: '/', icon: User },
];

interface AdminTopbarProps {
  sectionLabel: string;
  onOpenMobileSidebar: () => void;
}

export function AdminTopbar({ sectionLabel, onOpenMobileSidebar }: AdminTopbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-800 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-1.5 text-sm sm:flex">
        <span className="text-gray-400">Prime</span>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">{sectionLabel}</span>
      </div>

      <div className="relative ml-2 hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search bookings, cars, customers..."
          className="h-9 w-full rounded-lg border border-gray-200 bg-[#fafafa] pl-9 pr-3 text-sm text-gray-700 outline-none transition-all duration-300 placeholder:text-gray-400 focus:border-[#e3c08d] focus:bg-white focus:ring-2 focus:ring-[#e3c08d]/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-800"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>

        <div className="group relative ml-1">
          <button className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e3c08d]/20 text-xs font-semibold text-[#8b6b3e]">
              {initials}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="max-w-[140px] truncate text-sm font-medium text-gray-800">{user?.email}</p>
              <p className="text-xs text-gray-400">Administrator</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-300 group-hover:rotate-180" />
          </button>

          <div className="invisible absolute right-0 z-50 mt-1 w-52 rounded-lg border border-gray-100 bg-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
            <div className="flex flex-col py-1.5">
              {accountItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.path}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors duration-300 hover:cursor-pointer hover:bg-[#f7efe3] hover:text-[#8b6b3e]"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.title}
                </Link>
              ))}
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors duration-300 hover:cursor-pointer hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
