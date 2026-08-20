import React from 'react';
import {
  LayoutDashboard,
  Car,
  Users,
  Settings,
  DollarSign,
  CalendarDays,
  Calendar as CalendarIcon,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Manage',
    items: [
      { id: 'bookings', label: 'Bookings', icon: CalendarIcon },
      { id: 'cars', label: 'Fleet', icon: Car },
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays, isAction: true },
    ],
  },
  {
    label: 'Configure',
    items: [
      { id: 'pricing', label: 'Pricing', icon: DollarSign },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCalendar: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AdminSidebar({
  activeTab,
  onTabChange,
  onOpenCalendar,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const { user } = useAuth();
  const initials = user?.email?.[0]?.toUpperCase() ?? 'U';

  const handleSelectTab = (id: string) => {
    onTabChange(id);
    onCloseMobile();
  };

  const handleSelectCalendar = () => {
    onOpenCalendar();
    onCloseMobile();
  };

  return (
    <TooltipProvider>
      {/* Mobile backdrop */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:transition-[width] lg:duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b border-gray-200 ${
            isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e3c08d] text-sm font-bold text-white">
              P
            </div>
            <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-bold leading-tight text-gray-900">Prime</p>
              <p className="truncate text-[10px] font-medium uppercase leading-tight tracking-wider text-gray-400">
                Fleet Operations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 lg:flex ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isCollapsed && (
          <div className="hidden justify-center border-b border-gray-200 py-2 lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors duration-300 hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="sheet-scroll flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = !item.isAction && activeTab === item.id;
                  const navButton = (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (item.isAction ? handleSelectCalendar() : handleSelectTab(item.id))}
                      className={`group flex w-full items-center gap-3 rounded-lg border-l-[3px] py-2.5 text-sm font-medium transition-all duration-300 hover:cursor-pointer ${
                        isCollapsed ? 'justify-center px-0' : 'pl-[9px] pr-3'
                      } ${
                        active
                          ? 'border-[#E3C08D] bg-white text-[#8b6b3e] shadow-sm hover:bg-gray-50'
                          : 'border-transparent text-gray-600 hover:translate-x-0.5 hover:border-[#E3C08D]/40 hover:bg-[#f7efe3] hover:text-[#8b6b3e]'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors duration-300 ${
                          active ? 'text-[#8b6b3e]' : 'text-gray-400 group-hover:text-[#8b6b3e]'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );

                  if (!isCollapsed) return navButton;

                  return (
                    <Tooltip key={item.id} delayDuration={200}>
                      <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-400">Signed in as</p>
              <p className="truncate text-sm font-semibold text-gray-800">{user?.email}</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e3c08d]/20 text-xs font-semibold text-[#8b6b3e]">
                {initials}
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
