import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// 🔐 Stripe secrets
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16"
});
// EmailJS configuration
const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID");
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID");
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "balisaalik@gmail.com";

// EmailJS function to send admin notifications
async function sendAdminNotificationEmail(bookingId: string) {
  try {
    // Get booking details with car and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        car:cars(*),
        customer:customers(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Failed to fetch booking: ${bookingError?.message}`);
    }

    // Fetch active admin users from database
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('is_active', true);

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.log('No active admin users found');
      return;
    }

    const adminEmails = adminUsers.map(admin => admin.email).filter(Boolean);

    // Format dates and prices for email
    const formatDateTime = (dateTime: string) => {
      return new Date(dateTime).toLocaleString('en-US', {
        timeZone: 'Europe/Oslo',
        dateStyle: 'full',
        timeStyle: 'short',
      });
    };

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('no-NO', {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 0,
      }).format(price);
    };

    // Send email to each admin
    for (const adminEmail of adminEmails) {
      if (!adminEmail) continue;

      const templateParams = {
        to_email: adminEmail,
        from_name: 'Fjord Fleet Admin',
        booking_number: booking.booking_number,
        car_name: booking.car?.name || 'N/A',
        customer_name: booking.customer?.full_name || 'N/A',
        customer_email: booking.customer?.email || 'N/A',
        total_price: formatPrice(booking.total_price),
        pickup_datetime: formatDateTime(booking.start_datetime),
        return_datetime: formatDateTime(booking.end_datetime),
        admin_dashboard_url: `${Deno.env.get("SUPABASE_URL")}/admin/bookings/${booking.id}` 
      };

      // Send email via EmailJS
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: templateParams
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`EmailJS error for ${adminEmail}:`, errorText);
        continue; // Continue with other admins even if one fails
      }

      console.log(`Admin notification sent to ${adminEmail} for booking ${booking.booking_number}`);
    }

  } catch (error) {
    console.error('Error sending admin notification:', error);
    // Don't throw - don't block the webhook
  }
}

serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  let event;
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    console.log(`[STRIPE-WEBHOOK] Received event: ${event.type}`);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed.`, err.message);
    return new Response(`Webhook error: ${err.message}`, {
      status: 400
    });
  }
  try {
    const session = event.data.object;
    switch(event.type){
      // ✅ Payment completed
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        console.log("✅ Payment successful for session:", session.id);
        
        // Update payment status
        await supabase.from("payments").update({
          status: "paid"
        }).eq("stripe_session_id", session.id);

        // Get booking ID and send admin notification
        const { data: payment } = await supabase
          .from('payments')
          .select('booking_id')
          .eq('stripe_session_id', session.id)
          .single();
          
        if (payment?.booking_id) {
          await sendAdminNotificationEmail(payment.booking_id);
        }

        break;
      // ❌ Payment failed or expired
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        console.log("❌ Payment failed or expired:", session.id);
        await supabase.from("payments").update({
          status: "failed"
        }).eq("stripe_session_id", session.id);
        break;
      // 💸 Optional: handle refund
      case "charge.refunded":
        const charge = event.data.object;
        console.log("💸 Payment refunded:", charge.payment_intent);
        await supabase.from("payments").update({
          status: "refunded"
        }).eq("stripe_session_id", charge.payment_intent);
        break;
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
    return new Response(JSON.stringify({
      received: true
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (err) {
    console.error("⚠️ Error handling webhook event:", err);
    return new Response(`Webhook handler error: ${err}`, {
      status: 500
    });
  }
});
