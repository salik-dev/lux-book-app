import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/auth-context';

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      try {
        // First try to get booking by session ID (for non-logged in users)
        let { data: booking, error } = await supabase
          .from('bookings')
          .select(`
            *,
            car:cars(*)
          `)
          .eq('stripe_session_id', sessionId)
          .single();

        // If no booking found by session ID and user is logged in, try to get their latest booking
        if ((!booking || error) && user) {
          const { data: userBooking } = await supabase
            .from('bookings')
            .select(`
              *,
              car:cars(*)
            `)
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          booking = userBooking;
        }

        if (!booking) {
          throw new Error('Booking not found');
        }
        
        setBookingDetails(booking);
      } catch (error) {
        console.error('Error fetching booking details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookingDetails();
  }, [sessionId, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1518]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#e3c08d]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1518] text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[#1a2528] rounded-xl p-8 shadow-xl">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {/* <div className="bg-[#e3c08d] bg-opacity-20 p-4 rounded-full flex justify-center items-center"> */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-22 w-22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            {/* </div> */}
          </div>
          
          <h1 className="text-3xl font-bold mb-4 text-[#e3c08d]">Booking Confirmed!</h1>
          
          <p className="text-gray-300 mb-8">
            Thank you for your booking. Your payment was successful and your booking is now confirmed.
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
              onClick={() => navigate('/bookings')}
              className="bg-[#e3c08d] hover:cursor-pointer hover:bg-[#d1b07f] text-[#0d1518] font-medium py-6 px-8 rounded-lg transition-colors"
            >
              View My Bookings
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-[#e3c08d] hover:cursor-pointer text-[#e3c08d] hover:bg-[#e3c08d] hover:text-[#0d1518] font-medium py-6 px-8 rounded-lg transition-colors"
            >
              Back to Home
            </Button>
          </div>

          {/* <p className="mt-6 text-sm text-gray-400">
            A confirmation has been sent to your email address.
          </p> */}
        </div>
      </div>
    </div>
  );
}
