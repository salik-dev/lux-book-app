import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side car availability for the booking date pickers. Returns the set of car ids
 * that are NOT bookable for a given [start, end] window, so vehicle dropdowns can disable
 * them before the server rejects the booking.
 *
 * Blocking mirrors the server (supabase/functions/_shared/availability.ts) plus in-progress
 * rentals: a car is blocked when it has an overlapping booking that is confirmed, active, or
 * a pending hold that hasn't expired, OR an overlapping admin unavailability block.
 * Boundaries are inclusive (back-to-back bookings need a gap).
 */
export async function fetchUnavailableCarIds(
  startIso: string,
  endIso: string,
  opts?: { excludeBookingId?: string | null },
): Promise<Set<string>> {
  const nowIso = new Date().toISOString();

  let bookingsQuery = supabase
    .from("bookings")
    .select("car_id")
    .lte("start_datetime", endIso)
    .gte("end_datetime", startIso)
    .or(
      `status.eq.confirmed,status.eq.active,and(status.eq.pending,or(hold_expires_at.is.null,hold_expires_at.gt.${nowIso}))`,
    );
  if (opts?.excludeBookingId) bookingsQuery = bookingsQuery.neq("id", opts.excludeBookingId);

  const [bookings, blocks] = await Promise.all([
    bookingsQuery,
    supabase
      .from("car_unavailability")
      .select("car_id")
      .lte("start_datetime", endIso)
      .gte("end_datetime", startIso),
  ]);

  const ids = new Set<string>();
  if (!bookings.error) {
    for (const row of bookings.data ?? []) if (row.car_id) ids.add(String(row.car_id));
  }
  // car_unavailability is optional / may be blocked by RLS in some envs — ignore its errors.
  if (!blocks.error) {
    for (const row of blocks.data ?? []) if (row.car_id) ids.add(String(row.car_id));
  }
  return ids;
}

/**
 * Reactively tracks which cars are unavailable for the selected [start, end]. Debounced so
 * dragging the date pickers doesn't spam the database. Empty set while the range is invalid.
 */
export function useUnavailableCarIds(
  start: Date | null | undefined,
  end: Date | null | undefined,
  excludeBookingId?: string | null,
): { unavailableIds: Set<string>; loading: boolean } {
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);

  const startIso = start instanceof Date && !isNaN(start.getTime()) ? start.toISOString() : null;
  const endIso = end instanceof Date && !isNaN(end.getTime()) ? end.toISOString() : null;

  useEffect(() => {
    if (!startIso || !endIso || endIso <= startIso) {
      setUnavailableIds(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await fetchUnavailableCarIds(startIso, endIso, { excludeBookingId });
        if (!cancelled) setUnavailableIds(result);
      } catch {
        if (!cancelled) setUnavailableIds(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [startIso, endIso, excludeBookingId]);

  return { unavailableIds, loading };
}
