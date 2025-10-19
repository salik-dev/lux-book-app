import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/auth-context';

export default function BookingCancelled() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');

  useEffect(() => {
    const handleCancelledBooking = async () => {
      if (!bookingId) {
        setIsLoading(false);
        return;
      }

      setIsCancelling(true);
      try {
        // Update booking status to cancelled
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (updateError) throw updateError;

        // Get the booking details
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            car:cars(*)
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError) throw bookingError;

        setBookingDetails(booking);
      } catch (error) {
        console.error('Error handling cancelled booking:', error);
      } finally {
        setIsCancelling(false);
        setIsLoading(false);
      }
    };

    handleCancelledBooking();
  }, [bookingId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1518]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#e3c08d]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1518] text-white flex items-center justify-center p-4 mt-10">
      <div className="max-w-2xl w-full bg-[#1a2528] rounded-xl p-8 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-500 bg-opacity-20 p-4 rounded-full flex justify-center items-center">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-4 text-red-400">Booking Cancelled</h1>

          <p className="text-gray-300 mb-8">
            Your booking has been cancelled. The payment was not completed and no charges have been made to your account.
          </p>

          {bookingDetails && (
            <div className="bg-[#1e2d31] p-6 rounded-lg mb-8 text-left">
              <h2 className="text-xl font-semibold mb-4 text-[#e3c08d]">Booking Details</h2>
              <div className="space-y-3">
                <p><span className="font-medium">Booking #:</span> {bookingDetails.booking_number}</p>
                <p><span className="font-medium">Vehicle:</span> {bookingDetails.car?.name}</p>
                <p><span className="font-medium">Pickup:</span> {new Date(bookingDetails.start_datetime).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p><span className="font-medium">Drop-off:</span> {new Date(bookingDetails.end_datetime).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p className="pt-2 border-t border-gray-700 mt-3">
                  <span className="font-medium">Total:</span> {new Intl.NumberFormat('no-NO', {
                    style: 'currency',
                    currency: 'NOK',
                    minimumFractionDigits: 0,
                  }).format(bookingDetails.total_price)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/')}
              className="bg-[#e3c08d] hover:cursor-pointer hover:bg-[#d1b07f] text-[#0d1518] font-medium py-6 px-8 rounded-lg transition-colors"
            >
              Back to Home
            </Button>
            <Button
              onClick={() => navigate('/cars')}
              variant="outline"
              className="border-[#e3c08d] hover:cursor-pointer text-[#e3c08d] hover:bg-[#e3c08d] hover:text-[#0d1518] font-medium py-6 px-8 rounded-lg transition-colors"
            >
              Browse Cars Again
            </Button>
          </div>

          <p className="mt-6 text-sm text-gray-400">
            If you have any questions about your cancelled booking, please contact our support team.
          </p>
        </div>
      </div>
    </div>
  );
}
