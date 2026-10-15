/**
 * Starts Stripe Checkout for a customer's booking.
 *
 * - Requires the booking's access key (guest checkout, see _shared/booking-access.ts).
 * - Charges the booking's stored, server-computed total (never an amount from the browser).
 * - Requires the renter to have signed the rental agreement (Idura) first.
 * - Reuses an open Checkout session for the booking instead of creating duplicates.
 */

import Stripe from "https://esm.sh/stripe@14.21.0";
import { findConflicts, holdUntil } from "../_shared/availability.ts";
import { handlePost, HttpError, isUuid, json, readJsonBody, requireEnv } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { loadOwnedBooking, PAYABLE_STATUSES } from "../_shared/contract/service.ts";

/** Stripe's minimum Checkout lifetime is 30 minutes. */
const CHECKOUT_TTL_MS = 31 * 60 * 1000;

function appBaseUrl(req: Request): string {
  const configured = Deno.env.get("APP_BASE_URL")?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const origin = req.headers.get("origin");
  if (!origin) throw new HttpError(500, "SERVER_MISCONFIGURED", "The service is temporarily unavailable.");
  return origin.replace(/\/+$/, "");
}

Deno.serve(handlePost("create-payment", async (req, log) => {
  const admin = createAdminClient();
  const body = (await readJsonBody(req)) as Record<string, unknown>;
  if (!isUuid(body.bookingId)) throw new HttpError(400, "INVALID_REQUEST", "Invalid request.");
  const booking = await loadOwnedBooking(admin, body.bookingId, body.accessKey);

  if (booking.status !== "pending" || !booking.client_request_id) {
    throw new HttpError(409, "BOOKING_NOT_PAYABLE", "This booking can't be paid. Please start a new booking.");
  }
  if (new Date(booking.start_datetime).getTime() <= Date.now()) {
    throw new HttpError(409, "BOOKING_STARTED", "The pickup time has passed. Please choose new dates.");
  }

  const { data: contract, error: contractError } = await admin
    .from("booking_contracts")
    .select("id, status")
    .eq("booking_id", booking.id)
    .in("status", PAYABLE_STATUSES)
    .maybeSingle();
  if (contractError) throw contractError;
  if (!contract) {
    throw new HttpError(409, "CONTRACT_NOT_SIGNED", "Please sign the rental agreement before paying.");
  }

  const { data: payments, error: paymentsError } = await admin
    .from("payments")
    .select("id, status, stripe_session_id")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: false });
  if (paymentsError) throw paymentsError;
  if (payments?.some((p) => p.status === "paid")) {
    throw new HttpError(409, "ALREADY_PAID", "This booking has already been paid.");
  }

  const conflicts = await findConflicts(
    admin,
    booking.car.id,
    new Date(booking.start_datetime),
    new Date(booking.end_datetime),
    booking.id,
  );
  if (conflicts.blocked || conflicts.bookings.length > 0) {
    throw new HttpError(409, "CAR_ALREADY_BOOKED", "The car is no longer available for these dates. Please select other dates.");
  }

  const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2023-10-16" });
  const amountMinor = Math.round(Number(booking.total_price) * 100);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new HttpError(409, "BOOKING_NOT_PAYABLE", "This booking can't be paid online. Please contact us.");
  }

  // Reuse a still-open session for the same amount (double clicks, back button).
  for (const payment of payments ?? []) {
    if (payment.status !== "pending" || !payment.stripe_session_id) continue;
    try {
      const existing = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
      if (existing.status === "open" && existing.amount_total === amountMinor && existing.url) {
        log.info("checkout_session_reused", { bookingId: booking.id });
        return json({ url: existing.url, sessionId: existing.id });
      }
    } catch {
      // Unknown/expired session: fall through and create a new one.
    }
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("email")
    .eq("id", booking.customer.id)
    .single();
  if (customerError) throw customerError;

  const existingCustomers = await stripe.customers.list({ email: customer.email, limit: 1 });
  const stripeCustomerId = existingCustomers.data[0]?.id ??
    (await stripe.customers.create({ email: customer.email })).id;

  const { data: car } = await admin.from("cars").select("name, image_url").eq("id", booking.car.id).single();
  const baseUrl = appBaseUrl(req);
  const expiresAt = Date.now() + CHECKOUT_TTL_MS;

  // No idempotency key: expires_at differs per attempt, and duplicate open sessions are
  // avoided by reusing the pending one above.
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [{
      price_data: {
        currency: "nok",
        product_data: {
          name: `Prime Car - ${car?.name ?? booking.car.name}`,
          description: `Customer Email: ${customer.email}     • Booking ID: ${booking.booking_number}`,
          images: car?.image_url ? [car.image_url] : [],
        },
        unit_amount: amountMinor,
      },
      quantity: 1,
    }],
    mode: "payment",
    payment_method_types: ["card"],
    expires_at: Math.floor(expiresAt / 1000),
    success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/booking-cancelled?booking_id=${booking.id}`,
    metadata: { bookingId: booking.id },
  });

  const { error: insertError } = await admin.from("payments").insert({
    booking_id: booking.id,
    amount: amountMinor / 100,
    currency: "NOK",
    method: "stripe",
    status: "pending",
    stripe_session_id: session.id,
  });
  if (insertError) throw insertError;

  // Keep the car held while the customer is on the Stripe page.
  await admin
    .from("bookings")
    .update({ hold_expires_at: holdUntil(expiresAt, 5 * 60 * 1000) })
    .eq("id", booking.id)
    .not("hold_expires_at", "is", null);

  log.info("checkout_session_created", { bookingId: booking.id });
  return json({ url: session.url, sessionId: session.id });
}));
