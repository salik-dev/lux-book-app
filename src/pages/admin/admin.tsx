import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { BarChart3, Car, Users, Settings, DollarSign, Calendar } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';

const Admin = () => {
  const { t } = useTranslation();

  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

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
            <h1 className="text-3xl font-bold text-primary mb-2">{t('admin.title')}</h1>
            <p className="text-gray-500">
              Manage your luxury car rental business from one dashboard
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 lg:w-fit bg-[#f5f5f5] rounded-lg gap-2">
              <TabsTrigger value="overview" className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                <BarChart3 className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">{t('admin.overview')}</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Calendar className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">{t('admin.bookings')}</span>
              </TabsTrigger>
              <TabsTrigger value="cars" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Car className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">{t('admin.cars')}</span>
              </TabsTrigger>
              <TabsTrigger value="customers" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Users className="h-4 w-4" />
                <span className="flex items-center gap-[4px] rounded-lg hover:cursor-pointer transition-colors duration-500">{t('admin.customers')}</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <DollarSign className="h-4 w-4" />
                <span className="flex items-center gap-[4px] hover:cursor-pointer transition-colors duration-500">{t('admin.pricing')}</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 rounded-lg hover:cursor-pointer transition-colors duration-500">
                <Settings className="h-4 w-4" />
                <span className="flex items-center gap-[4px] hover:cursor-pointer transition-colors duration-500">{t('admin.settings')}</span>
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
                  <CardTitle>{t('admin.settings')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Settings management will be available soon.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Admin;