import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BookingDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    booking_number: string;
    status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
    start_datetime: string;
    end_datetime: string;
    pickup_location: string;
    delivery_location?: string | null;
    total_price: number;
    created_at: string;
    car: {
      id: string;
      name: string;
      brand: string;
      model: string;
      year?: number;
      registration_number?: string;
      base_price_per_hour: number;
      base_price_per_day: number;
      included_km_per_day: number;
      extra_km_rate: number;
    } | null;
    customer: {
      id: string;
      full_name: string;
      email: string;
      phone: string;
      address?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    } | null;
    payment: Array<{
      id: string;
      status: 'pending' | 'paid' | 'refunded' | 'failed' | null;
      method: 'stripe' | 'vipps' | 'bank_transfer' | 'cash';
      amount: number;
      currency: string;
      created_at: string;
      updated_at: string;
    }> | null;
  } | null;
  onStatusChange: (bookingId: string, status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled') => void;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'active':
      return 'secondary';
    case 'completed':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    case 'pending':
    default:
      return 'default';
  }
};

export const BookingDetailsDialog: React.FC<BookingDetailsDialogProps> = ({
  isOpen,
  onClose,
  booking,
  onStatusChange,
}) => {
  if (!booking) return null;

  const payment = booking.payment?.[0];
  const totalDays = Math.ceil(
    (new Date(booking.end_datetime).getTime() - new Date(booking.start_datetime).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-8 rounded-md overflow-y-auto bg-white border-0">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center gap-2">
            <div className='flex items-center gap-2'>
              <p className="text-[#e3c08d]">Booking #{booking.booking_number}</p>
              <Badge variant={getStatusBadgeVariant(booking.status)} className={`capitalize text-xs ${booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : booking.status === 'active' ? 'bg-green-100 text-green-800' : booking.status === 'completed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                {booking.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select
                value={booking.status}
                onValueChange={(value) => onStatusChange(booking.id, value as any)}
              >
                <SelectTrigger className="w-[150px] border-0 hover:cursor-pointer bg-[#f9fafb] text-gray-600">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className='border-0'>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="customer" className='data-[state=active]:bg-[#f9fafb] data-[state=active]:text-[#e3c08d] tracking-wide hover:bg-[#f9fafb] hover:text-[#e3c08d] transition-colors duration-500'>Customer</TabsTrigger>
            <TabsTrigger value="car" className='data-[state=active]:bg-[#f9fafb] data-[state=active]:text-[#e3c08d] tracking-wide hover:bg-[#f9fafb] hover:text-[#e3c08d] transition-colors duration-500'>Car Details</TabsTrigger>
            <TabsTrigger value="payment" className='data-[state=active]:bg-[#f9fafb] data-[state=active]:text-[#e3c08d] tracking-wide hover:bg-[#f9fafb] hover:text-[#e3c08d] transition-colors duration-500'>Payment</TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Customer Information</h3>
                  <div className="bg-[#f9fafb] p-4 rounded-lg">
                    <p className="font-semibold tracking text-gray-600">{booking.customer?.full_name}</p>
                    <p className="text-sm text-gray-600">{booking.customer?.email}</p>
                    <p className="text-sm text-gray-600">{booking.customer?.phone}</p>
                    {booking.customer?.address && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p>{booking.customer.address}</p>
                        {booking.customer.city && booking.customer.postal_code && (
                          <p>{`${booking.customer.postal_code} ${booking.customer.city}`}</p>
                        )}
                        {booking.customer.country && <p>{booking.customer.country}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Rental Period</h3>
                  <div className="bg-[#f9fafb] p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-600">Pickup:</span>
                      <span className='text-[13px] text-gray-600'>{format(new Date(booking.start_datetime), 'PPPp')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-600">Return:</span>
                      <span className='text-[13px] text-gray-600'>{format(new Date(booking.end_datetime), 'PPPp')}</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-[13px] text-gray-600">
                        <span className="font-medium text-gray-600 text-[13px]">Duration:</span> {totalDays} {totalDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Locations</h3>
                <div className="bg-[#f9fafb] p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-sm text-gray-700">Pickup Location</p>
                    <p className="text-gray-600 text-[13px]">{booking.pickup_location}</p>
                  </div>
                  {booking.delivery_location && (
                    <div>
                      <p className="font-medium text-sm text-gray-700">Delivery Location</p>
                      <p className="text-gray-600 text-[13px]">{booking.delivery_location}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="car" className="mt-6">
            {booking.car ? (
              <div className="space-y-4 bg-[#f9fafb] rounded-lg p-4">
                <h3 className="font-medium text-lg mb-4 text-gray-700">{booking.car.brand} {booking.car.model}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className='text-[13px]'>
                    <p className="text-sm text-gray-600">Vehicle Name</p>
                    <p className="font-medium text-gray-900">{booking.car.name}</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="font-medium mb-2 text-gray-700">Pricing Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm">Base Rate ({totalDays} {totalDays === 1 ? 'day' : 'days'})</span>
                      <span className="font-medium text-gray-900">NOK {booking.total_price.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span className="font-medium text-gray-900">NOK {booking.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No car information available</p>
            )}
          </TabsContent>

          <TabsContent value="payment" className="mt-6">
            {payment ? (
              <div className="space-y-4 bg-[#f9fafb] rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[13px] text-gray-600">Payment Status</p>
                    <Badge variant="outline" className={`capitalize text-xs ${payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : payment.status === 'paid' ? 'bg-blue-100 text-blue-800' : payment.status === 'failed' ? 'bg-red-100 text-red-800' : payment.status === 'refunded' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                      {payment.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-600">Payment Method</p>
                    <p className="capitalize text-gray-600 font-medium">{payment.method.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-600">Amount</p>
                    <p className="font-medium text-gray-600">{payment.currency} {payment.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-600">Payment Date</p>
                    <p className="font-medium text-gray-600">{format(new Date(payment.created_at), 'PPPp')}</p>
                    {/* <p className="font-medium text-gray-600">{payment.created_at}</p> */}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No payment information available</p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end items-center pt-4 mt-4 border-t border-gray-200">
          {/*  */}

          <div className="flex gap-4">
            <Button variant="outline" onClick={onClose} className='rounded-lg border-gray-200 hover:bg-[#e3c08d] hover:cursor-pointer transition-colors duration-500'>
              Close
            </Button>
            <Button onClick={onClose} className='rounded-lg border-gray-200 bg-[#e3c08d] hover:bg-white hover:cursor-pointer transition-colors duration-500'>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
