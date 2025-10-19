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
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: {
    persistSession: false
  }
});
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
        await supabase.from("payments").update({
          status: "paid"
        }).eq("stripe_session_id", session.id);
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
