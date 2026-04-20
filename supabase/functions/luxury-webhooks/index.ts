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
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

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
    if (!signature) throw new Error("Missing stripe-signature header");
    if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    console.log(`[STRIPE-WEBHOOK] Received event: ${event.type}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Webhook signature verification failed.`, message);
    return new Response(`Webhook error: ${message}`, {
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

        // Get booking ID from payments table; fall back to Stripe metadata if needed.
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .select('booking_id')
          .eq('stripe_session_id', session.id)
          .single();

        if (paymentError) {
          console.error("[STRIPE-WEBHOOK] payment lookup failed", {
            sessionId: session.id,
            error: paymentError,
          });
        }

        const bookingId = payment?.booking_id ?? session?.metadata?.bookingId ?? null;
        if (!bookingId) {
          console.error("[STRIPE-WEBHOOK] No bookingId resolved; skipping booking/email updates", {
            sessionId: session.id,
            paymentLookupBookingId: payment?.booking_id ?? null,
            metadataBookingId: session?.metadata?.bookingId ?? null,
          });
          break;
        }

        if (bookingId) {
          // Mark booking as confirmed when payment is settled.
          await supabase
            .from("bookings")
            .update({ status: "confirmed", updated_at: new Date().toISOString() })
            .eq("id", bookingId);

          // Send the normal customer confirmation email on successful payment.
          const { data: emailData, error: emailInvokeError } = await supabase.functions.invoke("send-booking-email", {
            body: {
              bookingId,
              emailType: "confirmation",
              language: "en",
            },
          });
          if (emailInvokeError) {
            console.error("[STRIPE-WEBHOOK] send-booking-email invoke failed", emailInvokeError);
          } else {
            console.log("[STRIPE-WEBHOOK] send-booking-email invoke ok", emailData);
          }

          // EmailJS admin notifications removed by request.
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
