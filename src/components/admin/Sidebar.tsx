import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Car,
  Users,
  DollarSign,
  Settings,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

export const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState<Record<string, boolean>>({
    bookings: true,
    fleet: true,
    customers: true,
  });

  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: 'Bookings',
      href: '/admin/bookings',
      icon: <Calendar className="h-5 w-5" />,
      children: [
        { title: 'All Bookings', href: '/admin/bookings', icon: <ChevronRight className="h-4 w-4" /> },
        { title: 'New Booking', href: '/admin/bookings/new', icon: <ChevronRight className="h-4 w-4" /> },
        { title: 'Calendar', href: '/admin/bookings/calendar', icon: <ChevronRight className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Fleet',
      href: '/admin/fleet',
      icon: <Car className="h-5 w-5" />,
      children: [
        { title: 'All Vehicles', href: '/admin/fleet', icon: <ChevronRight className="h-4 w-4" /> },
        { title: 'Add Vehicle', href: '/admin/fleet/new', icon: <ChevronRight className="h-4 w-4" /> },
        { title: 'Categories', href: '/admin/fleet/categories', icon: <ChevronRight className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Customers',
      href: '/admin/customers',
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: 'Pricing',
      href: '/admin/pricing',
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Settings',
      href: '/admin/settings',
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  const toggleCollapse = (key: string) => {
    setIsOpen(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <div className="w-64 bg-card border-r h-[calc(100vh-4rem)] fixed top-16 left-0 overflow-y-auto">
      <div className="p-4 space-y-1">
        {navItems.map((item) => (
          <div key={item.href}>
            {item.children ? (
              <Collapsible
                open={isOpen[item.title.toLowerCase()]}
                onOpenChange={() => toggleCollapse(item.title.toLowerCase())}
                className="space-y-1"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-between',
                      isActive(item.href) && 'bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    {isOpen[item.title.toLowerCase()] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 space-y-1">
                  {item.children.map((child) => (
                    <Button
                      key={child.href}
                      asChild
                      variant="ghost"
                      className={cn(
                        'w-full justify-start',
                        isActive(child.href) && 'bg-muted',
                      )}
                    >
                      <Link to={child.href}>
                        {child.icon}
                        <span className="ml-2">{child.title}</span>
                      </Link>
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Button
                asChild
                variant="ghost"
                className={cn(
                  'w-full justify-start',
                  isActive(item.href) && 'bg-muted',
                )}
              >
                <Link to={item.href}>
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
