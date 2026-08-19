import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Car, Users, DollarSign, TrendingUp, Clock, CheckCircle2, Gauge } from 'lucide-react';

interface OverviewStats {
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  totalCars: number;
  totalCustomers: number;
  monthlyRevenue: number;
}

interface RecentActivityItem {
  id: string;
  kind: 'booking' | 'payment' | 'extra_km';
  title: string;
  description: string;
  dotColor: string;
  at: string;
}

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats>({
    totalBookings: 0,
    activeBookings: 0,
    totalRevenue: 0,
    totalCars: 0,
    totalCustomers: 0,
    monthlyRevenue: 0,
  });
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRecentActivity();
  }, []);

  const loadStats = async () => {
    try {
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      const { count: activeBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'active']);

      const { data: revenueData } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('status', 'completed');

      const totalRevenue = revenueData?.reduce((sum, booking) => sum + Number(booking.total_price), 0) || 0;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyRevenueData } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString());

      const monthlyRevenue = monthlyRevenueData?.reduce((sum, booking) => sum + Number(booking.total_price), 0) || 0;

      const { count: totalCars } = await supabase
        .from('cars')
        .select('*', { count: 'exact', head: true });

      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalBookings: totalBookings || 0,
        activeBookings: activeBookings || 0,
        totalRevenue,
        totalCars: totalCars || 0,
        totalCustomers: totalCustomers || 0,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, status, total_price, created_at, updated_at,
          extra_km_charge_status, extra_km_price, booking_deposit,
          car:cars(name),
          payment:payments(status, amount, created_at)
        `)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;

      const items: RecentActivityItem[] = (data || []).flatMap((booking: any) => {
        const carName = booking.car?.name || 'Unknown vehicle';
        const rows: RecentActivityItem[] = [
          {
            id: `${booking.id}-booking`,
            kind: 'booking',
            title:
              booking.status === 'cancelled'
                ? 'Booking cancelled'
                : booking.status === 'completed'
                ? 'Booking completed'
                : 'New booking received',
            description: `${carName} — ${formatPrice(Number(booking.total_price))}`,
            dotColor:
              booking.status === 'cancelled'
                ? 'bg-red-500'
                : booking.status === 'completed'
                ? 'bg-gray-400'
                : 'bg-green-500',
            at: booking.created_at,
          },
        ];

        const latestPayment = Array.isArray(booking.payment) ? booking.payment[0] : null;
        if (latestPayment?.status === 'paid') {
          rows.push({
            id: `${booking.id}-payment`,
            kind: 'payment',
            title: 'Payment completed',
            description: `${carName} — ${formatPrice(Number(latestPayment.amount))}`,
            dotColor: 'bg-blue-500',
            at: latestPayment.created_at,
          });
        }

        if (booking.extra_km_charge_status && booking.extra_km_charge_status !== 'none') {
          rows.push({
            id: `${booking.id}-extra-km`,
            kind: 'extra_km',
            title:
              booking.extra_km_charge_status === 'paid'
                ? 'Extra km charge confirmed'
                : 'Extra km charge sent',
            description: `${carName} — ${formatPrice(Number(booking.booking_deposit ?? booking.extra_km_price ?? 0))}`,
            dotColor: booking.extra_km_charge_status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500',
            at: booking.updated_at ?? booking.created_at,
          });
        }

        return rows;
      });

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivity(items.slice(0, 6));
    } catch (error) {
      console.error('Error loading recent activity:', error);
      setActivity([]);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const cardItems = [
    {
      id: 1,
      title: 'Total Bookings',
      icon: Calendar,
      value: stats.totalBookings,
      description: 'All time bookings',
      accent: 'text-[#1e3a8a]',
    },
    {
      id: 2,
      title: 'Active Bookings',
      icon: Clock,
      value: stats.activeBookings,
      description: 'Currently active',
      accent: 'text-green-600',
    },
    {
      id: 3,
      title: 'Total Revenue',
      icon: DollarSign,
      value: formatPrice(stats.totalRevenue),
      description: 'Completed bookings, all time',
      accent: 'text-[#8b6b3e]',
    },
    {
      id: 4,
      title: 'Monthly Revenue',
      icon: TrendingUp,
      value: formatPrice(stats.monthlyRevenue),
      description: 'Completed bookings, this month',
      accent: 'text-[#8b6b3e]',
    },
    {
      id: 5,
      title: 'Fleet Size',
      icon: Car,
      value: stats.totalCars,
      description: 'Vehicles in the fleet',
      accent: 'text-[#1e3a8a]',
    },
    {
      id: 6,
      title: 'Total Customers',
      icon: Users,
      value: stats.totalCustomers,
      description: 'Registered customers',
      accent: 'text-[#1e3a8a]',
    },
  ];

  const activityIcon = (kind: RecentActivityItem['kind']) => {
    if (kind === 'payment') return CheckCircle2;
    if (kind === 'extra_km') return Gauge;
    return Calendar;
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse border-gray-200">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cardItems.map((item) => (
          <Card key={item.id} className="card-premium border-gray-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{item.title}</CardTitle>
              <item.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${item.accent}`}>{item.value}</div>
              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="card-premium border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">No recent activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => {
                const Icon = activityIcon(item.kind);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-300"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${item.dotColor}`} />
                    <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-500 truncate">{item.description}</p>
                    </div>
                    <div className="text-sm text-gray-400 shrink-0">
                      {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
