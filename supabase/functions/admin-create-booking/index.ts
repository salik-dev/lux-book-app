// @ts-nocheck
// -----------------------------------------------------------------------------
// admin-create-booking
//
// Production workflow for admin-created bookings on behalf of a verified
// customer. Responsibilities:
//   1. Authenticate caller is an active admin_users row.
//   2. Validate payload.
//   3. Call the SECURITY DEFINER RPC `admin_create_booking_on_behalf` which
//      atomically: validates eligibility (BankID verified + contract signed),
//      checks car availability and time-range overlap, inserts the booking,
//      and writes an audit row.
//   4. Create a Stripe Checkout session for the customer and persist a
//      `payments` row with the session id (status = pending).
//   5. Invoke `send-booking-email` with the `admin_invoice` template, passing
//      the Checkout URL so the customer can pay directly from the email.
//   6. Return { bookingId, bookingNumber, checkoutUrl }.
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
  console.log(`[ADMIN-CREATE-BOOKING] ${step}${tail}`);
};

function serializeError(e: unknown): { message: string; code?: string; details?: unknown; hint?: unknown } {
  if (e instanceof Error) return { message: e.message };
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    const msg =
      (typeof anyE.message === "string" && anyE.message) ||
      (typeof anyE.error === "string" && anyE.error) ||
      "unknown_error";
    return {
      message: String(msg),
      code: typeof anyE.code === "string" ? (anyE.code as string) : undefined,
      details: anyE.details ?? null,
      hint: anyE.hint ?? null,
    };
  }
  return { message: String(e) };
}

// PostgREST / Postgres error codes we care about.
const RPC_MISSING_CODES = new Set(["42883", "PGRST202", "PGRST100"]);
const ELIGIBILITY_CODES = new Set(["P0001"]);
const CAR_UNAVAILABLE_CODES = new Set(["P0002"]);
const OVERLAP_CODES = new Set(["P0003"]);

type Payload = {
  customerId: string;
  carId: string;
  startDateTime: string;
  endDateTime: string;
  pickupLocation: string;
  deliveryLocation?: string | null;
  deliveryFee?: number;
  basePrice: number;
  totalPrice: number;
  vatAmount: number;
  language?: "en" | "no";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(p: unknown): { ok: true; value: Payload } | { ok: false; error: string } {
  if (!p || typeof p !== "object") return { ok: false, error: "invalid_body" };
  const b = p as Record<string, unknown>;
  const must = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

  try {
    must(typeof b.customerId === "string" && UUID_RE.test(b.customerId), "customerId must be uuid");
    must(typeof b.carId === "string" && UUID_RE.test(b.carId), "carId must be uuid");
    must(typeof b.startDateTime === "string" && !Number.isNaN(Date.parse(b.startDateTime as string)), "startDateTime invalid");
    must(typeof b.endDateTime === "string" && !Number.isNaN(Date.parse(b.endDateTime as string)), "endDateTime invalid");
    must(new Date(b.endDateTime as string) > new Date(b.startDateTime as string), "end must be after start");
    must(typeof b.pickupLocation === "string" && (b.pickupLocation as string).trim().length > 0, "pickupLocation required");
    must(typeof b.basePrice === "number" && b.basePrice >= 0, "basePrice invalid");
    must(typeof b.totalPrice === "number" && b.totalPrice > 0, "totalPrice must be > 0");
    must(typeof b.vatAmount === "number" && b.vatAmount >= 0, "vatAmount invalid");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "validation_failed" };
  }

  return {
    ok: true,
    value: {
      customerId: b.customerId as string,
      carId: b.carId as string,
      startDateTime: b.startDateTime as string,
      endDateTime: b.endDateTime as string,
      pickupLocation: (b.pickupLocation as string).trim(),
      deliveryLocation: typeof b.deliveryLocation === "string" && b.deliveryLocation.trim() ? b.deliveryLocation.trim() : null,
      deliveryFee: typeof b.deliveryFee === "number" && b.deliveryFee >= 0 ? b.deliveryFee : 0,
      basePrice: b.basePrice as number,
      totalPrice: b.totalPrice as number,
      vatAmount: b.vatAmount as number,
      language: b.language === "no" ? "no" : "en",
    },
  };
}

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
      .select("id, is_active, role, full_name, email")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminUser?.is_active) return json({ error: "forbidden" }, 403);
    log("admin_authenticated", { adminId: adminUser.id });

    // 2. Validate body
    const parsed = validate(await req.json().catch(() => ({})));
    if (!parsed.ok) return json({ error: "bad_request", reason: parsed.error }, 400);
    const p = parsed.value;

    // 2b. Sync customer row from BankID verification BEFORE creating the booking.
    //     Ensures customers table always reflects the latest verified identity
    //     (full_name, date_of_birth) for the customer the admin booked on behalf of.
    try {
      await syncCustomerFromVerification(admin, p.customerId);
    } catch (syncErr) {
      // Non-fatal: booking can still proceed with the existing customers row.
      log("customer_sync_warning", serializeError(syncErr));
    }

    // 3. Create booking via RPC (atomic eligibility + overlap + insert).
    //    Falls back to direct inserts if the RPC is missing (migration not applied yet).
    let booking: Record<string, unknown> | null = null;

    const rpcRes = await admin.rpc("admin_create_booking_on_behalf", {
      p_customer_id: p.customerId,
      p_car_id: p.carId,
      p_start: p.startDateTime,
      p_end: p.endDateTime,
      p_pickup: p.pickupLocation,
      p_delivery: p.deliveryLocation,
      p_delivery_fee: p.deliveryFee ?? 0,
      p_base_price: p.basePrice,
      p_total_price: p.totalPrice,
      p_vat_amount: p.vatAmount,
      p_admin_user_id: adminUser.id,
    });

    if (rpcRes.error) {
      const ser = serializeError(rpcRes.error);
      log("rpc_error", ser);

      if (ELIGIBILITY_CODES.has(String(ser.code))) {
        return json({ error: "customer_ineligible", reason: ser.message }, 409);
      }
      if (CAR_UNAVAILABLE_CODES.has(String(ser.code))) {
        return json({ error: "car_unavailable", reason: ser.message }, 409);
      }
      if (OVERLAP_CODES.has(String(ser.code))) {
        return json({ error: "car_overlap", reason: ser.message }, 409);
      }

      if (
        RPC_MISSING_CODES.has(String(ser.code)) ||
        String(ser.code) === "42703" ||
        String(ser.message).toLowerCase().includes("admin_notes")
      ) {
        // Migration not applied — fall back to a direct insert and eligibility check.
        log("rpc_missing_fallback");
        booking = await fallbackCreateBooking(admin, p, adminUser.id);
      } else {
        return json({ error: "create_failed", reason: ser.message, details: ser.details }, 500);
      }
    } else {
      booking = rpcRes.data as Record<string, unknown> | null;
    }

    if (!booking?.id) return json({ error: "create_failed", reason: "no_booking_returned" }, 500);
    log("booking_created", { bookingId: booking.id, bookingNumber: booking.booking_number });

    // 4. Load customer + car (needed for Stripe + email)
    const [{ data: customer }, { data: car }] = await Promise.all([
      admin.from("customers").select("id, full_name, email, phone").eq("id", p.customerId).single(),
      admin.from("cars").select("id, name, image_url").eq("id", p.carId).single(),
    ]);
    if (!customer?.email) return json({ error: "customer_missing_email" }, 500);
    if (!car?.id) return json({ error: "car_missing" }, 500);

    // 5. Create Stripe Checkout session
    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "";
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-04-30.basil" });

    const stripeCustomers = await stripe.customers.list({ email: customer.email, limit: 1 });
    const stripeCustomerId =
      stripeCustomers.data[0]?.id ??
      (await stripe.customers.create({ email: customer.email, name: customer.full_name })).id;

    const amountMinor = Math.round(Number(booking.total_price) * 100);
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "nok",
            product_data: {
              name: `Car Rental - ${car.name}`,
              description: `Booking ${booking.booking_number} - ${booking.pickup_location}`,
              images: car.image_url ? [car.image_url] : [],
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
      cancel_url: `${origin}/booking-cancelled?booking_id=${booking.id}`,
      metadata: {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        channel: "admin",
        createdByAdminId: adminUser.id,
      },
      // Stripe Checkout requires expires_at to be within 24 hours.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 23, // 23 h
    });
    log("stripe_session_created", { sessionId: session.id });

    // 6. Persist payment row
    const { error: payErr } = await admin.from("payments").insert({
      booking_id: booking.id,
      amount: Number(booking.total_price),
      currency: "NOK",
      method: "stripe",
      status: "pending",
      stripe_session_id: session.id,
    });
    if (payErr) log("payment_insert_error", payErr.message);

    // 7. Fire email (non-blocking for the response, but awaited for error visibility)
    try {
      const { data: emailData, error: emailInvokeError } = await admin.functions.invoke("send-booking-email", {
        body: {
          bookingId: booking.id,
          emailType: "admin_invoice",
          language: p.language ?? "en",
          checkoutUrl: session.url,
          adminFullName: adminUser.full_name ?? null,
        },
      });
      if (emailInvokeError) {
        log("invoice_email_error", serializeError(emailInvokeError));
      } else {
        log("invoice_email_invoked", emailData ?? { ok: true });
      }
    } catch (e) {
      log("invoice_email_error", serializeError(e));
      // Do not fail the booking: admin can re-send from the UI.
    }

    return json({
      ok: true,
      bookingId: booking.id,
      bookingNumber: booking.booking_number,
      checkoutUrl: session.url,
      stripeSessionId: session.id,
    });
  } catch (err) {
    const ser = serializeError(err);
    log("fatal", ser);
    return json({ error: ser.message, details: ser.details, code: ser.code }, 500);
  }
});

// -----------------------------------------------------------------------------
// Sync the customers row from bankid_verifications.
//
// Admin-initiated bookings skip the self-service customer form, so we
// proactively backfill / refresh the customers row with the BankID-verified
// identity data. This guarantees the customers table is never "stale" after
// an admin creates a booking on behalf of someone.
// -----------------------------------------------------------------------------
async function syncCustomerFromVerification(
  admin: ReturnType<typeof createClient>,
  customerId: string
): Promise<void> {
  // 1. Most recent signed-contract verification for this customer.
  const { data: bvRows, error: bvErr } = await admin
    .from("bankid_verifications")
    .select("id, name, birth_date, nin, contract_status, contract_signed_at, verified_at")
    .eq("customer_id", customerId)
    .eq("contract_status", true)
    .order("contract_signed_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (bvErr) throw bvErr;
  const bv = bvRows?.[0];
  if (!bv) {
    // Customer exists but has no signed BankID verification — fall through
    // silently; eligibility check later will reject the booking.
    return;
  }

  // 2. Current customers row (may have missing/outdated fields).
  const { data: customer, error: custErr } = await admin
    .from("customers")
    .select("id, full_name, date_of_birth")
    .eq("id", customerId)
    .maybeSingle();

  if (custErr) throw custErr;
  if (!customer) return; // no row to update; booking FK would fail anyway

  // 3. Determine which fields need updating. Only overwrite empty/placeholder
  //    values to avoid clobbering admin-entered data. full_name is refreshed
  //    from BankID since that is the legal identity source of truth.
  const updates: Record<string, unknown> = {};

  if (bv.name && (!customer.full_name || customer.full_name.trim() === "" || customer.full_name !== bv.name)) {
    updates.full_name = bv.name;
  }
  if (bv.birth_date && !customer.date_of_birth) {
    updates.date_of_birth = bv.birth_date;
  }

  if (Object.keys(updates).length === 0) {
    // Still bump updated_at so there is an audit trail of "admin touched this row".
    updates.updated_at = new Date().toISOString();
  }

  const { error: upErr } = await admin.from("customers").update(updates).eq("id", customerId);
  if (upErr) throw upErr;

  console.log("[ADMIN-CREATE-BOOKING] customer_synced", {
    customerId,
    fields: Object.keys(updates),
  });
}

// -----------------------------------------------------------------------------
// Fallback path used when the admin_create_booking_on_behalf RPC is missing.
// Performs the same validations in application code and inserts directly.
// -----------------------------------------------------------------------------
async function fallbackCreateBooking(
  admin: ReturnType<typeof createClient>,
  p: Payload,
  adminUserId: string
): Promise<Record<string, unknown>> {
  // 1. Eligibility: BankID-verified + contract signed.
  const { data: eligible } = await admin
    .from("bankid_verifications")
    .select("id, contract_status, customer_id")
    .eq("customer_id", p.customerId)
    .eq("contract_status", true)
    .limit(1);

  if (!eligible || eligible.length === 0) {
    throw { code: "P0001", message: "Customer is not eligible (BankID + signed contract required)" };
  }

  // 2. Car availability.
  const { data: car } = await admin
    .from("cars")
    .select("id, is_available")
    .eq("id", p.carId)
    .maybeSingle();
  if (!car?.is_available) {
    throw { code: "P0002", message: "Car is not available" };
  }

  // 3. Overlap check on the same car.
  const { data: overlap } = await admin
    .from("bookings")
    .select("id, start_datetime, end_datetime, status")
    .eq("car_id", p.carId)
    .in("status", ["pending", "confirmed", "active"])
    .lte("start_datetime", p.endDateTime)
    .gte("end_datetime", p.startDateTime);
  if (overlap && overlap.length > 0) {
    throw { code: "P0003", message: "Car is already booked in the requested window" };
  }

  // 4. Insert booking.
  const bookingNumber =
    "FJB" +
    new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14) +
    Math.random().toString(36).slice(2, 6);

  const insertPayload: Record<string, unknown> = {
    booking_number: bookingNumber,
    customer_id: p.customerId,
    car_id: p.carId,
    start_datetime: p.startDateTime,
    end_datetime: p.endDateTime,
    pickup_location: p.pickupLocation,
    delivery_location: p.deliveryLocation,
    delivery_fee: p.deliveryFee ?? 0,
    base_price: p.basePrice,
    total_price: p.totalPrice,
    vat_amount: p.vatAmount,
    status: "pending",
  };

  // Include new columns only if they exist (migration applied): detect via a harmless insert retry pattern.
  // We attempt with the admin columns first, retry without them on failure.
  try {
    const withChannel = {
      ...insertPayload,
      booking_channel: "admin",
      created_by_admin_id: adminUserId,
    };
    const { data, error } = await admin.from("bookings").insert(withChannel).select().single();
    if (error) throw error;
    return data as Record<string, unknown>;
  } catch (e) {
    const ser = (e && typeof e === "object" ? (e as Record<string, unknown>) : {}) as Record<string, unknown>;
    const msg = String(ser.message ?? "");
    const code = String(ser.code ?? "");
    const missingSchemaColumn =
      code === "PGRST204" ||
      (msg.includes("column") && msg.includes("does not exist")) ||
      (msg.includes("schema cache") && msg.includes("booking_channel")) ||
      (msg.includes("schema cache") && msg.includes("created_by_admin_id")) ||
      (msg.includes("schema cache") && msg.includes("admin_notes"));
    if (missingSchemaColumn) {
      const { data, error } = await admin.from("bookings").insert(insertPayload).select().single();
      if (error) throw error;
      return data as Record<string, unknown>;
    }
    throw e;
  }
}
