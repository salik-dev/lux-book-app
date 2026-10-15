import type { AdminClient } from "./supabase.ts";

/** How long an unpaid online booking holds the car at each step. */
export const BOOKING_HOLD_MS = 30 * 60 * 1000;

export const holdUntil = (from = Date.now(), ms = BOOKING_HOLD_MS) => new Date(from + ms).toISOString();

/**
 * PostgREST filter for bookings that occupy a car: confirmed bookings, and pending
 * bookings whose hold hasn't expired (no hold = legacy/admin, always blocks).
 *
 * Mirrors the step-1 check in src/components/booking/booking-details.tsx. `active` is
 * deliberately not blocking there: the previous checkout inserted unpaid bookings as
 * `active`, so counting it would let abandoned legacy rows block cars.
 */
export const blockingBookingFilter = (nowIso: string) =>
  `status.eq.confirmed,and(status.eq.pending,or(hold_expires_at.is.null,hold_expires_at.gt.${nowIso}))`;

export interface OverlapRow {
  id: string;
  customer_id: string | null;
  status: string | null;
}

/**
 * Bookings and admin blocks overlapping [start, end] for a car. Boundaries are inclusive,
 * matching the step-1 availability check (back-to-back bookings need a gap).
 */
export async function findConflicts(
  admin: AdminClient,
  carId: string,
  start: Date,
  end: Date,
  excludeBookingId?: string,
): Promise<{ bookings: OverlapRow[]; blocked: boolean }> {
  let bookingsQuery = admin
    .from("bookings")
    .select("id, customer_id, status")
    .eq("car_id", carId)
    .or(blockingBookingFilter(new Date().toISOString()))
    .lte("start_datetime", end.toISOString())
    .gte("end_datetime", start.toISOString())
    .limit(20);
  if (excludeBookingId) bookingsQuery = bookingsQuery.neq("id", excludeBookingId);

  const [bookings, blocks] = await Promise.all([
    bookingsQuery,
    admin
      .from("car_unavailability")
      .select("id")
      .eq("car_id", carId)
      .lte("start_datetime", end.toISOString())
      .gte("end_datetime", start.toISOString())
      .limit(1),
  ]);
  if (bookings.error) throw bookings.error;
  if (blocks.error) throw blocks.error;
  return { bookings: (bookings.data ?? []) as OverlapRow[], blocked: (blocks.data?.length ?? 0) > 0 };
}
