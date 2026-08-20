import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useNavigate } from 'react-router-dom';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { BookingsManagement } from '@/components/admin/BookingsManagement';
import { CarsManagement } from '@/components/admin/CarsManagement';
import { CustomersManagement } from '@/components/admin/CustomersManagement';
import { PricingManagement } from '@/components/admin/PricingManagement';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/pages/admin/schedule/components/ui/sheet';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { CarCalendarContainer } from '@/pages/admin/schedule/calendar/components/car-calendar-container';
import { AdminHeaderSlotContext } from '@/context/admin-header-slot';

const SECTION_LABELS: Record<string, string> = {
  overview: 'Dashboard',
  bookings: 'Bookings',
  cars: 'Fleet',
  customers: 'Customers',
  pricing: 'Pricing',
  settings: 'Settings',
};

/** Tabs whose management component portals a search bar + action button(s) into the header. */
const DATA_TABLE_TABS = new Set(['bookings', 'cars', 'customers']);

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('admin-sidebar-collapsed', String(isSidebarCollapsed));
    } catch {
      // ignore storage failures (e.g. private browsing)
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    console.log('Admin page - Auth state:', { user: user?.id, email: user?.email, isAdmin, loading });
    if (!loading && (!user || !isAdmin)) {
      console.log('Admin access denied - redirecting to home');
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const isDataTableTab = DATA_TABLE_TABS.has(activeTab);

  return (
    <div className={`bg-gray-50 ${isDataTableTab ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
      />

      <div
        className={`flex flex-col transition-all duration-300 ease-in-out ${
          isDataTableTab ? 'h-screen overflow-hidden' : 'min-h-screen'
        } ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}
      >
        <AdminTopbar
          sectionLabel={SECTION_LABELS[activeTab] ?? 'Dashboard'}
          onOpenMobileSidebar={() => setIsMobileNavOpen(true)}
        />

        <main
          className={`flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 ${
            isDataTableTab ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'
          }`}
        >

          {isDataTableTab && (
            <div
              ref={setHeaderSlot}
              className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            />
          )}

          <AdminHeaderSlotContext.Provider value={headerSlot}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={isDataTableTab ? 'flex min-h-0 flex-1 flex-col' : 'space-y-6'}
          >
            <TabsContent value="overview" className="step-enter-forward space-y-6">
              <AdminOverview />
            </TabsContent>

            <TabsContent value="bookings" className="step-enter-forward flex min-h-0 flex-1 flex-col">
              <BookingsManagement />
            </TabsContent>

            <TabsContent value="cars" className="step-enter-forward flex min-h-0 flex-1 flex-col">
              <CarsManagement />
            </TabsContent>

            <TabsContent value="customers" className="step-enter-forward flex min-h-0 flex-1 flex-col">
              <CustomersManagement />
            </TabsContent>

            <TabsContent value="pricing" className="step-enter-forward space-y-6">
              <PricingManagement />
            </TabsContent>

            <TabsContent value="settings" className="step-enter-forward space-y-6">
              <Card className="card-premium bg-white">
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Settings management will be available soon.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </AdminHeaderSlotContext.Provider>

          <Sheet open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[90vw]">
              <SheetTitle className="sr-only">Calendar</SheetTitle>

              <div className="flex min-h-0 flex-1 flex-col p-6">
                {isCalendarOpen && <CarCalendarContainer />}
              </div>
            </SheetContent>
          </Sheet>
        </main>
      </div>
    </div>
  );
};

export default Admin;
