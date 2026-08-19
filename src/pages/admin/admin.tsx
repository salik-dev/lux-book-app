import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/header';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { BookingsManagement } from '@/components/admin/BookingsManagement';
import { CarsManagement } from '@/components/admin/CarsManagement';
import { CustomersManagement } from '@/components/admin/CustomersManagement';
import { PricingManagement } from '@/components/admin/PricingManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle } from '@/pages/admin/schedule/components/ui/sheet';
import { BarChart3, Car, Users, Settings, DollarSign, Calendar, CalendarDays } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CarCalendarContainer } from '@/pages/admin/schedule/calendar/components/car-calendar-container';

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-gray-50 mt-18 px-18">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              {/* {t('admin.title')} */}
              Admin Dashboard
            </h1>
            <p className="text-gray-500">
              Manage your luxury car rental business from one dashboard
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7 lg:w-fit bg-[#f5f5f5] rounded-lg gap-2">
              <TabsTrigger value="overview" className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                <BarChart3 className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.overview')} */}
                  Overview
                </span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Calendar className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.bookings')} */}
                  Bookings
                </span>
              </TabsTrigger>
              <TabsTrigger value="cars" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Car className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.cars')} */}
                  Cars
                </span>
              </TabsTrigger>
              <TabsTrigger value="customers" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Users className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.customers')} */}
                  Customers
                </span>
              </TabsTrigger>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-gray-500 transition-colors duration-500 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="flex items-center gap-[4px]">Calendar</span>
              </button>
              <TabsTrigger value="pricing" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <DollarSign className="h-4 w-4" />
                <span className="flex items-center gap-[4px] hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.pricing')} */}
                  Pricing
                </span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Settings className="h-4 w-4" />
                <span className="flex items-center gap-[4px] hover:cursor-pointer transition-colors duration-500">
                  {/* {t('admin.settings')} */}
                  Settings
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <AdminOverview />
            </TabsContent>

            <TabsContent value="bookings" className="space-y-6">
              <BookingsManagement />
            </TabsContent>

            <TabsContent value="cars" className="space-y-6">
              <CarsManagement />
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              <CustomersManagement />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <PricingManagement />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
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

          <Sheet open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <SheetContent side="right" className="w-full p-0 sm:max-w-[90vw] overflow-y-auto">
              <SheetTitle className="sr-only">Calendar</SheetTitle>

              <div className="h-full p-6">
                {isCalendarOpen && <CarCalendarContainer />}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
};

export default Admin;