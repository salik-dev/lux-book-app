// @ts-nocheck
// -----------------------------------------------------------------------------
// create-extra-km-charge
//
// Admin-only: confirms an extra-kilometer overage charge for a completed/active
// booking, deducted from the car's deposit. Responsibilities:
//   1. Authenticate caller is an active admin_users row.
//   2. Validate payload and cap the charge at the car's deposit amount.
//   3. Create a Stripe Checkout session for the charge amount.
//   4. Persist the charge on the booking row + a `payments` row (status pending).
//   5. Optionally invoke `send-booking-email` with the `extra_km_charge` template.
//   6. Return { ok, checkoutUrl, sessionId, chargeAmount, depositAmount }.
// -----------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.1.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: unknown) => {
  const tail = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  console.log(`[CREATE-EXTRA-KM-CHARGE] ${step}${tail}`);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("missing_supabase_env");
    if (!STRIPE_KEY) throw new Error("missing_stripe_env");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1. Admin auth
    const authHeader = req.headers.get("Authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "").trim();
    if (!userJwt) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(userJwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: adminUser } = await admin
      .from("admin_users")
      .select("id, is_active, full_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminUser?.is_active) return json({ error: "forbidden" }, 403);
    log("admin_authenticated", { adminId: adminUser.id });

    // 2. Validate body
    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
    const extraKmDriven = Number(body.extraKmDriven);
    const chargeAmount = Number(body.chargeAmount);
    const sendEmail = body.sendEmail === true;
    const language = body.language === "no" ? "no" : "en";

    if (!UUID_RE.test(bookingId)) return json({ error: "bad_request", reason: "bookingId must be uuid" }, 400);
    if (!Number.isFinite(extraKmDriven) || extraKmDriven < 0) {
      return json({ error: "bad_request", reason: "extraKmDriven must be >= 0" }, 400);
    }
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return json({ error: "bad_request", reason: "chargeAmount must be > 0" }, 400);
    }

    // 3. Load booking + car + customer
    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, booking_number, pickup_location, booking_deposit, customer:customers(id, full_name, email), car:cars(id, name, image_url, deposit_amount)")
      .eq("id", bookingId)
      .single();
    if (bookingErr || !booking) return json({ error: "booking_not_found" }, 404);
    if (!booking.customer?.email) return json({ error: "customer_missing_email" }, 500);

    // Informational only — no cap is enforced; the confirmed charge amount is allowed to
    // exceed the original deposit snapshot.
    const originalDepositAmount = Number(booking.booking_deposit ?? booking.car?.deposit_amount ?? 0);

    // 4. Create Stripe Checkout session
    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "";
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-04-30.basil" });

    const stripeCustomers = await stripe.customers.list({ email: booking.customer.email, limit: 1 });
    const stripeCustomerId =
      stripeCustomers.data[0]?.id ??
      (await stripe.customers.create({ email: booking.customer.email, name: booking.customer.full_name })).id;

    const amountMinor = Math.round(chargeAmount * 100);
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: {
              name: `Extra kilometer charge - ${booking.car?.name ?? "Rental"}`,
              description: `Booking ${booking.booking_number} - ${extraKmDriven} km over the included limit`,
              images: booking.car?.image_url ? [booking.car.image_url] : [],
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_method_types: ["card"],
      wallet_options: { link: { display: "never" } },
      success_url: `${origin}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bookings`,
      metadata: {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        purpose: "extra_km_charge",
        extraKmDriven: String(extraKmDriven),
        createdByAdminId: adminUser.id,
      },
      // Stripe Checkout requires expires_at to be within 24 hours.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 23, // 23 h
    });
    log("stripe_session_created", { sessionId: session.id });

    // 5. Persist the charge on the booking + a payments row.
    // The confirmed charge amount replaces `booking_deposit` (it may end up larger than
    // the original deposit snapshot — that's expected, not an error).
    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        extra_km_driven: extraKmDriven,
        extra_km_price: chargeAmount,
        booking_deposit: chargeAmount,
        deposit_amount_status: false,
        extra_km_charge_status: "pending",
        extra_km_checkout_url: session.url,
        extra_km_session_id: session.id,
      })
      .eq("id", bookingId);
    if (updateErr) log("booking_update_error", updateErr.message);

    const { error: payErr } = await admin.from("payments").insert({
      booking_id: bookingId,
      amount: chargeAmount,
      currency: "NOK",
      method: "stripe",
      status: "pending",
      stripe_session_id: session.id,
    });
    if (payErr) log("payment_insert_error", payErr.message);

    // 6. Optionally email the checkout link right away
    if (sendEmail) {
      try {
        const { error: emailInvokeError } = await admin.functions.invoke("send-booking-email", {
          body: {
            bookingId,
            emailType: "extra_km_charge",
            language,
            checkoutUrl: session.url,
            adminFullName: adminUser.full_name ?? null,
          },
        });
        if (emailInvokeError) log("email_error", emailInvokeError);
      } catch (e) {
        log("email_error", e instanceof Error ? e.message : String(e));
      }
    }

    return json({
      ok: true,
      bookingId,
      checkoutUrl: session.url,
      sessionId: session.id,
      chargeAmount,
      originalDepositAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("unhandled_error", message);
    return json({ error: message }, 500);
  }
});
