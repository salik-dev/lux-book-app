/**
 * Creates (or returns) a booking with a server-computed price. Works for guests.
 *
 * Replaces the browser-side insert in the booking flow so the amount printed on the
 * contract and charged by Stripe can't be chosen by the client.
 *
 * The browser supplies a random `accessKey`; its hash is stored on the booking and the
 * key is required for every later contract/payment call (see _shared/booking-access.ts).
 * Idempotent on `requestId` + `accessKey`: repeating a request returns the same booking.
 */

import { z } from "npm:zod@3.23.8";
import { findConflicts, holdUntil } from "../_shared/availability.ts";
import { calculateBookingPricing } from "../_shared/booking-pricing.ts";
import type { User } from "npm:@supabase/supabase-js@2.58.0";
import { accessKeyMatches, hashAccessKey } from "../_shared/booking-access.ts";
import { handlePost, HttpError, json, readJsonBody } from "../_shared/http.ts";
import { type AdminClient, createAdminClient, optionalUser } from "../_shared/supabase.ts";

const MIN_LEAD_MS = 60 * 60 * 1000; // matches MIN_PICKUP_LEAD_HOURS in src/lib/booking-time.ts
const LEAD_GRACE_MS = 15 * 60 * 1000; // time spent filling in steps 2-3
const MAX_RENTAL_MS = 2 * 366 * 24 * 60 * 60 * 1000;

/** Printable single-line text: these values end up on the contract PDF. */
// deno-lint-ignore no-control-regex -- matching control characters is the point.
const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;
const text = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL_CHARS);
const optionalText = (max: number) => z.string().trim().max(max).regex(NO_CONTROL_CHARS).optional().nullable();

const accessKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const RequestSchema = z.object({
  requestId: z.string().uuid(),
  accessKey,
  /**
   * Book for the customer in `customer` rather than for the signed-in caller. Used by the
   * admin "book on behalf" flow: the admin is authenticated, but the booking (and its new
   * customer record) must belong to the typed customer, never the admin's own profile.
   */
  onBehalf: z.boolean().default(false),
  /** Booking this request replaces (customer went back and changed details), with its key. */
  supersedesBookingId: z.string().uuid().optional().nullable(),
  supersedesAccessKey: accessKey.optional().nullable(),
  carId: z.string().uuid(),
  startDateTime: z.string().datetime({ offset: true }),
  endDateTime: z.string().datetime({ offset: true }),
  seatPricingMode: z.enum(["flat-rate", "daily-basis", "monthly-basis"]),
  pickupLocation: text(300),
  deliveryLocation: optionalText(300),
  decorationFlowers: z.boolean().default(false),
  decorationRibbon: z.boolean().default(false),
  decorationRedCarpets: z.boolean().default(false),
  decorationDriverNeed: z.boolean().default(false),
  customer: z.object({
    firstName: text(100),
    lastName: text(100),
    nin: optionalText(20),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: text(40),
    address: text(200),
    postalCode: text(20),
    city: text(100),
    bookingForCompany: z.boolean().default(false),
    orgName: optionalText(200),
    orgNo: optionalText(30),
  }),
});

type BookingRequest = z.infer<typeof RequestSchema>;

interface BookingResult {
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  totalPrice: number;
  depositAmount: number;
  totalExcludingDeposit: number;
}

function toResult(row: {
  id: string;
  booking_number: string;
  customer_id: string;
  total_price: number | string;
  booking_deposit: number | string | null;
}): BookingResult {
  const total = Number(row.total_price);
  const deposit = Number(row.booking_deposit ?? 0);
  return {
    bookingId: row.id,
    bookingNumber: row.booking_number,
    customerId: row.customer_id,
    totalPrice: total,
    depositAmount: deposit,
    totalExcludingDeposit: Math.round((total - deposit) * 100) / 100,
  };
}

/**
 * Resolves the customer record for this booking.
 *
 * Signed-in users reuse their own profile (or claim an unlinked one with their verified
 * email). Guests always get a new record: matching on a typed-in email would let anyone
 * overwrite another person's stored details.
 */
async function resolveCustomer(admin: AdminClient, user: User | null, input: BookingRequest["customer"]) {
  const details = {
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: `${input.firstName} ${input.lastName}`,
    nin: input.nin || null,
    email: input.email,
    phone: input.phone,
    address: input.address,
    postal_code: input.postalCode,
    city: input.city,
  };

  if (user) {
    const { data: owned, error: ownedError } = await admin
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ownedError) throw ownedError;
    let customerId = owned?.id as string | undefined;

    if (!customerId && user.email) {
      const { data: unlinked, error } = await admin
        .from("customers")
        .select("id")
        .is("user_id", null)
        .ilike("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      customerId = unlinked?.id as string | undefined;
    }

    if (customerId) {
      const { error } = await admin.from("customers").update({ ...details, user_id: user.id }).eq("id", customerId);
      if (error) throw error;
      return customerId;
    }
  }

  const { data: created, error: createError } = await admin
    .from("customers")
    .insert({ ...details, user_id: user?.id ?? null })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id as string;
}

/**
 * Cancels an unpaid online booking so it stops holding the car. Callers must have
 * established ownership first. Returns whether it was cancelled.
 */
async function cancelUnpaidHold(admin: AdminClient, bookingId: string): Promise<boolean> {
  const { data: paid, error: paidError } = await admin
    .from("payments")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .limit(1);
  if (paidError) throw paidError;
  if (paid && paid.length > 0) return false;

  const { data, error } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("status", "pending")
    .not("client_request_id", "is", null)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

Deno.serve(handlePost("create-booking", async (req, log) => {
  const admin = createAdminClient();
  const user = await optionalUser(req, admin);

  const parsed = RequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    throw new HttpError(400, "INVALID_REQUEST", "Some booking details are invalid. Please review them and try again.", {
      fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))],
    });
  }
  const input = parsed.data;

  // Idempotency: the same request (and key) always maps to the same booking.
  const { data: existing, error: existingError } = await admin
    .from("bookings")
    .select("id, booking_number, customer_id, total_price, booking_deposit, access_key_hash")
    .eq("client_request_id", input.requestId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (!(await accessKeyMatches(input.accessKey, existing.access_key_hash))) {
      throw new HttpError(409, "REQUEST_CONFLICT", "Please refresh the page and try again.");
    }
    return json(toResult(existing));
  }

  const start = new Date(input.startDateTime);
  const end = new Date(input.endDateTime);
  if (end <= start) throw new HttpError(400, "INVALID_DATES", "The return time must be after the pickup time.");
  if (end.getTime() - start.getTime() > MAX_RENTAL_MS) {
    throw new HttpError(400, "INVALID_DATES", "The rental period is too long. Please contact us for long-term rentals.");
  }
  if (start.getTime() < Date.now() + MIN_LEAD_MS - LEAD_GRACE_MS) {
    throw new HttpError(409, "PICKUP_TOO_SOON", "The pickup time is too soon. Please choose a later time.");
  }

  const { data: car, error: carError } = await admin
    .from("cars")
    .select("id, base_price_per_hour, base_price_per_day, base_price_per_month, deposit_amount, is_available")
    .eq("id", input.carId)
    .maybeSingle();
  if (carError) throw carError;
  if (!car || car.is_available === false) {
    throw new HttpError(409, "CAR_UNAVAILABLE", "This car is not available. Please choose another car.");
  }

  // "On behalf" bookings (admin flow) resolve the customer from the typed details as a
  // guest, never from the signed-in admin's own profile.
  const customerId = await resolveCustomer(admin, input.onBehalf ? null : user, input.customer);

  // Release this browser's previous attempt, proven by its key.
  if (input.supersedesBookingId && input.supersedesAccessKey) {
    const { data: previous, error } = await admin
      .from("bookings")
      .select("access_key_hash")
      .eq("id", input.supersedesBookingId)
      .maybeSingle();
    if (error) throw error;
    if (previous && (await accessKeyMatches(input.supersedesAccessKey, previous.access_key_hash))) {
      await cancelUnpaidHold(admin, input.supersedesBookingId);
    }
  }

  const conflicts = await findConflicts(admin, car.id, start, end);
  // The customer's own unpaid holds on the same car and dates are abandoned attempts.
  let stillBlocking = 0;
  for (const booking of conflicts.bookings) {
    // A signed-in customer's own unpaid hold on the same car and dates is an abandoned attempt.
    const ownHold = user !== null && booking.customer_id === customerId && booking.status === "pending";
    if (!ownHold || !(await cancelUnpaidHold(admin, booking.id))) stillBlocking += 1;
  }
  if (conflicts.blocked || stillBlocking > 0) {
    throw new HttpError(409, "CAR_ALREADY_BOOKED", "The car is already booked for these dates. Please select other dates.");
  }

  const withDriver = input.decorationDriverNeed;
  const pricing = calculateBookingPricing({
    car,
    start,
    end,
    mode: input.seatPricingMode,
    withDriver,
  });
  if (pricing.totalExcludingDeposit <= 0) {
    throw new HttpError(409, "PRICE_UNAVAILABLE", "This car can't be booked online right now. Please contact us.");
  }

  const company = input.customer.bookingForCompany;
  const record = {
    client_request_id: input.requestId,
    customer_id: customerId,
    car_id: car.id,
    start_datetime: start.toISOString(),
    end_datetime: end.toISOString(),
    pickup_location: input.pickupLocation,
    delivery_location: input.deliveryLocation || null,
    delivery_fee: pricing.deliveryFee,
    base_price: pricing.basePrice,
    total_price: pricing.totalPrice,
    booking_deposit: pricing.depositAmount,
    with_driver: withDriver,
    seat_pricing_mode: input.seatPricingMode,
    org_name: company && input.customer.orgName ? input.customer.orgName : null,
    org_no: company && input.customer.orgNo ? input.customer.orgNo : null,
    decoration_require: input.decorationFlowers || input.decorationRibbon || input.decorationRedCarpets,
    decoration_flowers: input.decorationFlowers,
    decoration_ribbon: input.decorationRibbon,
    decoration_red_carpets: input.decorationRedCarpets,
    decoration_driver_need: input.decorationDriverNeed,
    status: "pending",
    hold_expires_at: holdUntil(),
    access_key_hash: await hashAccessKey(input.accessKey),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const bookingNumber = `FJB${Date.now()}${attempt ? attempt : ""}`;
    const { data: booking, error } = await admin
      .from("bookings")
      .insert({ ...record, booking_number: bookingNumber })
      .select("id, booking_number, customer_id, total_price, booking_deposit")
      .single();

    if (!error) {
      log.info("booking_created", { bookingId: booking.id });
      return json(toResult(booking));
    }
    if (error.code !== "23505") throw error;

    // A concurrent identical request won the race on client_request_id.
    const { data: raced } = await admin
      .from("bookings")
      .select("id, booking_number, customer_id, total_price, booking_deposit")
      .eq("client_request_id", input.requestId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (raced) return json(toResult(raced));
    // Otherwise the booking number collided; retry with a new one.
  }
  throw new HttpError(503, "BOOKING_BUSY", "We couldn't create your booking. Please try again.");
}));
