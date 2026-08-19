// @ts-nocheck
// -----------------------------------------------------------------------------
// admin-create-booking
//
// Production workflow for admin-created bookings. The admin enters the
// customer's details manually (no BankID/contract required for this channel)
// and confirms their driver's licence via the Vegvesen check before this
// function is called. Responsibilities:
//   1. Authenticate caller is an active admin_users row.
//   2. Validate payload, including that the licence was verified.
//   3. Find-or-create the `customers` row by email.
//   4. Check car availability and time-range overlap, then insert the booking.
//   5. Create a Stripe Checkout session for the customer and persist a
//      `payments` row with the session id (status = pending).
//   6. Invoke `send-booking-email` with the `admin_invoice` template, passing
//      the Checkout URL so the customer can pay directly from the email.
//   7. Return { bookingId, bookingNumber, checkoutUrl }.
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
const CAR_UNAVAILABLE_CODES = new Set(["P0002"]);
const OVERLAP_CODES = new Set(["P0003"]);

type Payload = {
  customerFullName: string;
  customerLastName: string;
  customerNin: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string | null;
  customerPostalCode: string | null;
  customerCity: string | null;
  licenseVerified: boolean;
  licenseCategories: string[];
  carId: string;
  startDateTime: string;
  endDateTime: string;
  pickupLocation: string;
  deliveryLocation?: string | null;
  deliveryFee?: number;
  withDriver?: boolean;
  decorationRequired?: boolean;
  basePrice: number;
  totalPrice: number;
  language?: "en" | "no";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(p: unknown): { ok: true; value: Payload } | { ok: false; error: string } {
  if (!p || typeof p !== "object") return { ok: false, error: "invalid_body" };
  const b = p as Record<string, unknown>;
  const must = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

  try {
    must(typeof b.customerFullName === "string" && b.customerFullName.trim().length > 0, "customerFullName is required");
    must(typeof b.customerLastName === "string" && b.customerLastName.trim().length > 0, "customerLastName is required");
    must(typeof b.customerNin === "string" && /^\d{11}$/.test(b.customerNin), "customerNin must be 11 digits");
    must(typeof b.customerEmail === "string" && /\S+@\S+\.\S+/.test(b.customerEmail), "customerEmail is invalid");
    must(typeof b.customerPhone === "string" && b.customerPhone.trim().length > 0, "customerPhone is required");
    must(b.licenseVerified === true, "licenseVerified must be true — verify the driver's licence before creating the booking");
    must(typeof b.carId === "string" && UUID_RE.test(b.carId), "carId must be uuid");
    must(typeof b.startDateTime === "string" && !Number.isNaN(Date.parse(b.startDateTime as string)), "startDateTime invalid");
    must(typeof b.endDateTime === "string" && !Number.isNaN(Date.parse(b.endDateTime as string)), "endDateTime invalid");
    must(new Date(b.endDateTime as string) > new Date(b.startDateTime as string), "end must be after start");
    must(typeof b.pickupLocation === "string" && (b.pickupLocation as string).trim().length > 0, "pickupLocation required");
    must(typeof b.basePrice === "number" && b.basePrice >= 0, "basePrice invalid");
    must(typeof b.totalPrice === "number" && b.totalPrice > 0, "totalPrice must be > 0");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "validation_failed" };
  }

  return {
    ok: true,
    value: {
      customerFullName: (b.customerFullName as string).trim(),
      customerLastName: (b.customerLastName as string).trim(),
      customerNin: b.customerNin as string,
      customerEmail: (b.customerEmail as string).trim().toLowerCase(),
      customerPhone: (b.customerPhone as string).trim(),
      customerAddress: typeof b.customerAddress === "string" && b.customerAddress.trim() ? b.customerAddress.trim() : null,
      customerPostalCode: typeof b.customerPostalCode === "string" && b.customerPostalCode.trim() ? b.customerPostalCode.trim() : null,
      customerCity: typeof b.customerCity === "string" && b.customerCity.trim() ? b.customerCity.trim() : null,
      licenseVerified: true,
      licenseCategories: Array.isArray(b.licenseCategories) ? b.licenseCategories.map(String) : [],
      carId: b.carId as string,
      startDateTime: b.startDateTime as string,
      endDateTime: b.endDateTime as string,
      pickupLocation: (b.pickupLocation as string).trim(),
      deliveryLocation: typeof b.deliveryLocation === "string" && b.deliveryLocation.trim() ? b.deliveryLocation.trim() : null,
      deliveryFee: typeof b.deliveryFee === "number" && b.deliveryFee >= 0 ? b.deliveryFee : 0,
      withDriver: b.withDriver === true,
      decorationRequired: b.decorationRequired === true,
      basePrice: b.basePrice as number,
      totalPrice: b.totalPrice as number,
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

    // 3. Find-or-create the customer row by email.
    const fullName = `${p.customerFullName} ${p.customerLastName}`.trim();
    const { data: existingCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("email", p.customerEmail)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
      await admin
        .from("customers")
        .update({
          full_name: fullName,
          phone: p.customerPhone,
          address: p.customerAddress,
          postal_code: p.customerPostalCode,
          city: p.customerCity,
        })
        .eq("id", customerId);
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from("customers")
        .insert({
          full_name: fullName,
          email: p.customerEmail,
          phone: p.customerPhone,
          address: p.customerAddress,
          postal_code: p.customerPostalCode,
          city: p.customerCity,
        })
        .select("id")
        .single();
      if (insertErr) return json({ error: "customer_create_failed", reason: insertErr.message }, 500);
      customerId = inserted.id;
    }
    log("customer_resolved", { customerId });

    // 4. Create the booking directly — this channel verifies identity via manual entry +
    // driver's-licence check rather than BankID + signed contract, so no eligibility RPC.
    let booking: Record<string, unknown>;
    try {
      booking = await createBookingDirect(admin, p, customerId, adminUser.id);
    } catch (e) {
      const ser = serializeError(e);
      log("create_booking_error", ser);
      if (CAR_UNAVAILABLE_CODES.has(String(ser.code))) return json({ error: "car_unavailable", reason: ser.message }, 409);
      if (OVERLAP_CODES.has(String(ser.code))) return json({ error: "car_overlap", reason: ser.message }, 409);
      return json({ error: "create_failed", reason: ser.message }, 500);
    }

    log("booking_created", { bookingId: booking.id, bookingNumber: booking.booking_number });
    await applyWithDriverFlag(admin, String(booking.id), p.withDriver === true);
    await applyDecorationRequireFlag(admin, String(booking.id), p.decorationRequired === true);

    // 5. Load car (needed for Stripe + email)
    const { data: car } = await admin
      .from("cars")
      .select("id, name, image_url, deposit_amount")
      .eq("id", p.carId)
      .single();
    if (!car?.id) return json({ error: "car_missing" }, 500);

    // Snapshot the car's deposit amount onto the booking, so it's available later for the
    // admin's extra-km-charge action even if the car's own deposit_amount changes afterwards.
    await admin
      .from("bookings")
      .update({ booking_deposit: car.deposit_amount ?? 0 })
      .eq("id", booking.id);

    // 6. Create Stripe Checkout session
    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "";
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-04-30.basil" });

    const stripeCustomers = await stripe.customers.list({ email: p.customerEmail, limit: 1 });
    const stripeCustomerId =
      stripeCustomers.data[0]?.id ??
      (await stripe.customers.create({ email: p.customerEmail, name: fullName })).id;

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

    // 7. Persist payment row
    const { error: payErr } = await admin.from("payments").insert({
      booking_id: booking.id,
      amount: Number(booking.total_price),
      currency: "NOK",
      method: "stripe",
      status: "pending",
      stripe_session_id: session.id,
    });
    if (payErr) log("payment_insert_error", payErr.message);

    // 8. Fire email (non-blocking for the response, but awaited for error visibility)
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

async function applyWithDriverFlag(
  admin: ReturnType<typeof createClient>,
  bookingId: string,
  withDriver: boolean
): Promise<void> {
  const { error } = await admin
    .from("bookings")
    .update({ with_driver: withDriver })
    .eq("id", bookingId);

  if (!error) return;

  const code = String((error as { code?: string }).code ?? "");
  const msg = String((error as { message?: string }).message ?? "").toLowerCase();
  const missingColumn =
    code === "42703" ||
    msg.includes("with_driver") ||
    msg.includes("schema cache");

  if (missingColumn) {
    log("with_driver_column_missing_skip", { bookingId });
    return;
  }

  throw error;
}

async function applyDecorationRequireFlag(
  admin: ReturnType<typeof createClient>,
  bookingId: string,
  decorationRequired: boolean
): Promise<void> {
  const { error } = await admin
    .from("bookings")
    .update({ decoration_require: decorationRequired })
    .eq("id", bookingId);

  if (!error) return;

  const code = String((error as { code?: string }).code ?? "");
  const msg = String((error as { message?: string }).message ?? "").toLowerCase();
  const missingColumn =
    code === "42703" ||
    msg.includes("decoration_require") ||
    msg.includes("schema cache");

  if (missingColumn) {
    log("decoration_require_column_missing_skip", { bookingId });
    return;
  }

  throw error;
}

// -----------------------------------------------------------------------------
// Creates the booking directly in application code: checks car availability and
// overlap, then inserts. Manual-entry admin bookings don't go through the
// BankID/contract eligibility RPC, so this is the only insert path now.
// -----------------------------------------------------------------------------
async function createBookingDirect(
  admin: ReturnType<typeof createClient>,
  p: Payload,
  customerId: string,
  adminUserId: string
): Promise<Record<string, unknown>> {
  // 1. Car availability.
  const { data: car } = await admin
    .from("cars")
    .select("id, is_available")
    .eq("id", p.carId)
    .maybeSingle();
  if (!car?.is_available) {
    throw { code: "P0002", message: "Car is not available" };
  }

  // 2. Overlap check on the same car.
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

  // 3. Insert booking.
  const bookingNumber =
    "FJB" +
    new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14) +
    Math.random().toString(36).slice(2, 6);

  const insertPayload: Record<string, unknown> = {
    booking_number: bookingNumber,
    customer_id: customerId,
    car_id: p.carId,
    start_datetime: p.startDateTime,
    end_datetime: p.endDateTime,
    pickup_location: p.pickupLocation,
    delivery_location: p.deliveryLocation,
    delivery_fee: p.deliveryFee ?? 0,
    base_price: p.basePrice,
    total_price: p.totalPrice,
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
