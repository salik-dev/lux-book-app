import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminHeaderSlot } from '@/context/admin-header-slot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, Filter, Download, Eye, Edit, Gauge, ChevronRight, ChevronsRight, ChevronLeft, ChevronsLeft, UserPlus, Building2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { BookingDetailsDialog } from './BookingDetailsDialog';
import { AdminBookOnBehalfDialog } from './book-on-behalf/AdminBookOnBehalfDialog';
import { AdminExtraKmChargeSheet } from './extra-km-charge/AdminExtraKmChargeSheet';

interface Booking {
  id: string;
  booking_number: string;
  status: string | null;
  start_datetime: string;
  end_datetime: string;
  pickup_location: string;
  delivery_location?: string | null;
  total_price: number;
  decoration_require?: boolean | null;
  org_name?: string | null;
  org_no?: string | null;
  created_at: string;
  extra_km_driven?: number | null;
  extra_km_price?: number | null;
  extra_km_charge_status?: string | null;
  extra_km_checkout_url?: string | null;
  booking_deposit?: number | null;
  deposit_amount_status?: boolean | null;
  car: {
    name: string;
    brand: string;
    model: string;
    base_price_per_hour: number;
    base_price_per_day: number;
    included_km_per_day: number;
    extra_km_rate: number;
    deposit_amount?: number | null;
  } | null;
  customer: {
    full_name: string;
    email: string;
    phone: string;
  } | null;
  payment: Array<{
    status: "pending" | "paid" | "refunded" | "failed" | null;
    method: "stripe" | "vipps";
    amount: number;
    created_at: string;
  }> | null;
}

export const BookingsManagement: React.FC = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBookOnBehalfOpen, setIsBookOnBehalfOpen] = useState(false);
  const [extraKmChargeBooking, setExtraKmChargeBooking] = useState<Booking | null>(null);

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled') => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      // Update the local state to reflect the change immediately
      setBookings(bookings.map(booking => 
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      ));
      // If we're viewing the booking, update the selected booking as well
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking({
          ...selectedBooking,
          status: newStatus
        });
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          car:cars(name, brand, model, base_price_per_hour, base_price_per_day, included_km_per_day, extra_km_rate, deposit_amount),
          customer:customers(full_name, email, phone),
          payment:payments(status, method, amount, created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bookings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Booking status updated successfully',
      });

      loadBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to update booking status',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string | null = 'unknown') => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.booking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.customer?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.car?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

    return matchesSearch && matchesStatus;
  });


  // Add these calculations before the return statement
  const totalItems = filteredBookings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  // Add this function to handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <Card className="card-premium">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const headerSlot = useAdminHeaderSlot();

  return (
    <TooltipProvider>
    <>
      {headerSlot && createPortal(
        <>
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg border-gray-200 bg-[#fafafa] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d] focus-visible:bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBookOnBehalfOpen(true)}
              className='rounded-lg bg-[#e3c08d] text-white hover:bg-[#d3b07d] hover:cursor-pointer transition-colors duration-500'
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Book on behalf
            </Button>
            <Button
              variant="outline"
              size="sm"
              className='rounded-lg border border-gray-200 bg-white text-gray-700 shadow-none hover:cursor-pointer hover:bg-[#e3c08d] hover:text-black transition-colors duration-300 dark:bg-white dark:text-gray-700 dark:border-gray-200 dark:hover:bg-[#e3c08d] dark:hover:text-black'
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </>,
        headerSlot
      )}
      <Card className="card-premium bg-white flex flex-1 min-h-0 flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4 shrink-0">
          <CardTitle className="text-lg">Bookings Management</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-[#fafafa] border-gray-200 hover:cursor-pointer data-[size=default]:h-10">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className='rounded-lg border-gray-200'>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="flex flex-1 min-h-0 flex-col space-y-4 px-5 pb-5 pt-0">
        {/* Bookings Table */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-gray-200">
          <Table className='bg-white rounded-lg' containerClassName="h-full overflow-auto table-scroll">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <TableRow className="text-gray-500 border-gray-200">
                <TableHead>Booking #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.map((booking) => (
                <TableRow key={booking.id} className='hover:bg-[#f7efe3] transition-colors duration-300 border-gray-200'>
                  <TableCell className="font-medium">
                    {booking.booking_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{booking.customer?.full_name || 'No customer data'}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <span>{booking.customer?.email || ''}</span>
                        {(booking.org_name || booking.org_no) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center text-[#8b6b3e]">
                                <Building2 className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Organization: {booking.org_name || "-"} | Org no: {booking.org_no || "-"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{booking.car?.name || 'No car data'}</div>
                    {booking.decoration_require && (
                      <div className="text-[11px] font-medium text-amber-700 mt-0.5">Decoration</div>
                    )}
                    {booking.extra_km_charge_status && booking.extra_km_charge_status !== 'none' && (
                      <div
                        className={`text-[11px] font-medium mt-0.5 ${
                          booking.extra_km_charge_status === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        Extra KM: {formatPrice(Number(booking.booking_deposit ?? booking.extra_km_price ?? 0))}
                        {' '}({booking.extra_km_charge_status === 'paid' ? 'Confirmed' : 'Pending'})
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs leading-3">
                      <div style={{ color: 'blue' }}>{format(new Date(booking.start_datetime), 'MMM dd, yyyy, hh:mm a')}</div>
                      <span className="mx-14">&#x2193;</span>
                      <div style={{ color: 'red' }}>{format(new Date(booking.end_datetime), 'MMM dd, yyyy, hh:mm a')}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(booking.total_price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className='hover:bg-[#e3c08d] hover:cursor-pointer transition-colors duration-500 rounded-xl'
                            onClick={() => handleViewDetails(booking)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View booking details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExtraKmChargeBooking(booking)}
                            className='border border-[#e3c08d]/50 text-[#8b6b3e] hover:bg-[#e3c08d] hover:text-black hover:cursor-pointer transition-colors duration-500 rounded-xl shrink-0'
                          >
                            <Gauge className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Extra kilometer charge</TooltipContent>
                      </Tooltip>
                      <Select
                        value={booking.status || ''}
                        onValueChange={(value) => updateBookingStatus(booking.id, (value || 'pending') as 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled')}
                      >
                        <SelectTrigger className="w-[120px] rounded-xl bg-[#fafafa] border-gray-200 hover:cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='rounded-lg border-gray-200'>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Rendering */}
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t bg-white rounded-b-lg border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} bookings
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = currentPage <= 3
                    ? i + 1
                    : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={`h-8 w-8 p-0 border border-gray-300 rounded-lg hover:cursor-pointer ${currentPage === page ? 'bg-[#e3c08d] text-white' : 'bg-white text-gray-700 shadow-none hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700'}`}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {filteredBookings.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No bookings found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Booking Details Dialog */}
    {selectedBooking && (
      <BookingDetailsDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        booking={{
          ...selectedBooking,
          status: selectedBooking.status as 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled',
          car: selectedBooking.car || {
            id: null,
            name: 'N/A',
            brand: 'N/A',
            model: 'N/A',
            base_price_per_hour: null,
            base_price_per_day: null,
            included_km_per_day: null,
            extra_km_rate: null,
            image_url: null
          },
          customer: selectedBooking.customer || {
            id: null,
            full_name: 'N/A',
            email: 'N/A',
            phone: 'N/A'
          },
          payment: selectedBooking.payment || [{
            id: null,
            status: 'pending',
            method: 'stripe',
            amount: 0,
            currency: 'NOK',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]
        }}
        onStatusChange={handleStatusChange}
      />
    )}

    <AdminBookOnBehalfDialog
      open={isBookOnBehalfOpen}
      onOpenChange={setIsBookOnBehalfOpen}
      onBookingCreated={() => loadBookings()}
    />

    <AdminExtraKmChargeSheet
      open={Boolean(extraKmChargeBooking)}
      onOpenChange={(open) => { if (!open) setExtraKmChargeBooking(null); }}
      booking={extraKmChargeBooking}
      onCharged={() => loadBookings()}
    />
    </>
    </TooltipProvider>
  );
};