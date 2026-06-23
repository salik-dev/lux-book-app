import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { sweepExpiredCarUnavailability } from "@/lib/car-unavailability-sweep";
import type { IEvent, IUser, ICalendarCar } from "@/pages/admin/schedule/calendar/interfaces";
import type { TEventColor } from "@/pages/admin/schedule/calendar/types";

// ── Booking status → event color ─────────────────────────────────────────────
const STATUS_COLOR: Record<string, TEventColor> = {
  pending: "yellow",
  confirmed: "blue",
  active: "green",
  completed: "gray",
  cancelled: "red",
};

const BLOCK_COLOR: TEventColor = "orange";

interface BookingRow {
  id: string;
  booking_number: string;
  status: string | null;
  start_datetime: string;
  end_datetime: string;
  total_price: number;
  car_id: string | null;
  customer: { full_name: string; email: string } | null;
}

interface UnavailabilityRow {
  id: string;
  car_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string | null;
}

export interface CarCalendarData {
  users: IUser[];
  events: IEvent[];
  cars: ICalendarCar[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads the real data behind the admin car-availability calendar:
 *   - cars      → calendar resources (IUser)
 *   - bookings  → IEvent (kind: "booking", colored by status)
 *   - blocks    → IEvent (kind: "block", from car_unavailability)
 *
 * Degrades gracefully: if the `car_unavailability` table has not been
 * migrated yet, blocks are simply omitted (logged, not thrown).
 */
export function useCarCalendarData(enabled = true): CarCalendarData {
  const [cars, setCars] = useState<ICalendarCar[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await sweepExpiredCarUnavailability();

      const [carsRes, bookingsRes, blocksRes] = await Promise.all([
        supabase
          .from("cars")
          .select("id, name, brand, model, image_url, is_available, base_price_per_hour, base_price_per_day")
          .order("name"),
        supabase
          .from("bookings")
          .select(`
            id, booking_number, status, start_datetime, end_datetime, total_price, car_id,
            customer:customers(full_name, email)
          `)
          .neq("status", "cancelled")
          .order("start_datetime", { ascending: true }),
        // May fail if the migration hasn't been applied — handled below.
        supabase
          .from("car_unavailability")
          .select("id, car_id, start_datetime, end_datetime, reason"),
      ]);

      if (carsRes.error) throw carsRes.error;
      if (bookingsRes.error) throw bookingsRes.error;

      const carRows = (carsRes.data || []) as ICalendarCar[];
      const carById = new Map(carRows.map((c) => [c.id, c]));

      const toUser = (carId: string | null): IUser => {
        const car = carId ? carById.get(carId) : undefined;
        return {
          id: carId ?? "unknown",
          name: car ? car.name : "Unknown vehicle",
          picturePath: car?.image_url ?? null,
        };
      };

      const calendarUsers: IUser[] = carRows.map((c) => ({
        id: c.id,
        name: c.name,
        picturePath: c.image_url ?? null,
      }));

      let id = 1;
      const bookingEvents: IEvent[] = ((bookingsRes.data || []) as unknown as BookingRow[]).map((b) => ({
        id: id++,
        startDate: new Date(b.start_datetime).toISOString(),
        endDate: new Date(b.end_datetime).toISOString(),
        title: `${b.booking_number}${b.customer?.full_name ? ` · ${b.customer.full_name}` : ""}`,
        color: STATUS_COLOR[b.status ?? "pending"] ?? "blue",
        description: b.customer?.full_name
          ? `Booking for ${b.customer.full_name}`
          : "Booking",
        user: toUser(b.car_id),
        kind: "booking",
        referenceId: b.id,
        carId: b.car_id ?? undefined,
        status: b.status ?? "pending",
        meta: {
          bookingNumber: b.booking_number,
          customerName: b.customer?.full_name ?? null,
          customerEmail: b.customer?.email ?? null,
          total: b.total_price,
        },
      }));

      let blockEvents: IEvent[] = [];
      if (blocksRes.error) {
        console.warn(
          "car_unavailability not available (apply the migration to enable unavailability blocks):",
          blocksRes.error.message
        );
      } else {
        blockEvents = ((blocksRes.data || []) as unknown as UnavailabilityRow[]).map((u) => {
          const car = carById.get(u.car_id);
          return {
            id: id++,
            startDate: new Date(u.start_datetime).toISOString(),
            endDate: new Date(u.end_datetime).toISOString(),
            title: `Unavailable${u.reason ? ` — ${u.reason}` : ""}`,
            color: BLOCK_COLOR,
            description: u.reason || "Marked unavailable",
            user: {
              id: u.car_id,
              name: car ? car.name : "Unknown vehicle",
              picturePath: car?.image_url ?? null,
            },
            kind: "block",
            referenceId: u.id,
            carId: u.car_id,
            meta: { reason: u.reason },
          } satisfies IEvent;
        });
      }

      setCars(carRows);
      setUsers(calendarUsers);
      setEvents([...bookingEvents, ...blockEvents]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load car calendar data:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  return { users, events, cars, loading, error, refetch: load };
}
