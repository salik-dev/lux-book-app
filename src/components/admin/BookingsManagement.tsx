import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, Filter, Download, Eye, Edit, Mail, ChevronRight, ChevronsRight, ChevronLeft, ChevronsLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BookingDetailsDialog } from './BookingDetailsDialog';
import { CalendarIcon } from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  status: string | null;
  start_datetime: string;
  end_datetime: string;
  pickup_location: string;
  delivery_location?: string | null;
  total_price: number;
  created_at: string;
  car: {
    name: string;
    brand: string;
    model: string;
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
  }> | null;
}

export const BookingsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
          car:cars(name, brand, model),
          customer:customers(full_name, email, phone),
          payment:payments(status, method, amount)
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

  const sendEmailReminder = async (bookingId: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-booking-email', {
        body: {
          bookingId,
          emailType: 'reminder',
          language: 'en',
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Reminder email sent successfully',
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reminder email',
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

  return (
    <>
      <Card className="card-premium bg-white">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('admin.bookings')} Management</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className='rounded-lg border-gray-200 hover:bg-[#e3c08d] hover:cursor-pointer transition-colors duration-500'>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-lg border-gray-200 bg-[#fafafa]"
              />
            </div>
          </div>
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
        </div>

        {/* Bookings Table */}
        <div className="rounded-md border border-gray-200">
          <Table className='bg-white rounded-lg'>
            <TableHeader>
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
                <TableRow key={booking.id} className='hover:bg-[#fafafa] transition-colors duration-500 border-gray-200   '>
                  <TableCell className="font-medium">
                    {booking.booking_number}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{booking.customer?.full_name || 'No customer data'}</div>
                      <div className="text-sm text-gray-500">{booking.customer?.email || ''}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{booking.car?.name || 'No car data'}</div>
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
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className='hover:bg-[#e3c08d] hover:cursor-pointer transition-colors duration-500 rounded-xl'
                        onClick={() => handleViewDetails(booking)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendEmailReminder(booking.id)}
                        className='hover:bg-[#e3c08d] hover:cursor-pointer transition-colors duration-500 rounded-xl'
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
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
          <div className="flex items-center justify-between px-4 py-3 border-t bg-white rounded-b-lg border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} bookings
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border-gray-300 rounded-lg hover:cursor-pointer"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border-gray-300 rounded-lg hover:cursor-pointer"
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
                      className={`h-8 w-8 p-0 border-gray-300 rounded-lg hover:cursor-pointer ${currentPage === page ? 'bg-[#e3c08d] text-white' : ''}`}
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
                className="h-8 w-8 p-0 border-gray-300 rounded-lg hover:cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 border-gray-300 rounded-lg hover:cursor-pointer"
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
            model: 'N/A'
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
    </>
  );
};