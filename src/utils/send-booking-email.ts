import { supabase } from "@/integrations/supabase/client";

export const notifyAdminAboutNewBooking = async (bookingId: string) => {
  try {
    // First, get all admin users
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('is_active', true);

    if (adminError) throw adminError;

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('No active admin users found to notify');
      return;
    }

    const adminEmails = adminUsers.map(admin => admin.email).filter(Boolean);

    // Call the send-booking-email function for each admin
    const response = await supabase.functions.invoke('send-booking-email', {
      body: {
        bookingId,
        emailType: 'admin_notification',
        language: 'en' // or get from user preferences
      }
    });

    console.log('Admin notification sent successfully', response);
  } catch (error) {
    console.error('Error notifying admin:', error);
    // Don't throw the error to not block the booking flow
  }
};