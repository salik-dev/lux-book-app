import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateBookingPricing } from "@shared/booking-pricing";
import type {
  AdminBookingPricing,
  AdminCarOption,
  CreateBookingPayload,
  CreateBookingResponse,
} from "./types";

/** Mutation wrapper for the vegvesen-license-check edge function. */
export function useVerifyDriverLicense() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: false, error: null });

  const verify = useCallback(async (nin: string, lastName: string) => {
    setState({ loading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("vegvesen-license-check", {
        body: { nin, lastName },
      });
      if (error) {
        let message = error.message || "Driver's licence verification failed.";
        try {
          const ctxBody = await (error as { context?: Response }).context?.json?.();
          if (ctxBody?.error) message = String(ctxBody.error);
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }
      if (!data?.verified) {
        throw new Error(data?.message || "Driver's licence could not be verified.");
      }
      setState({ loading: false, error: null });
      return {
        categories: Array.isArray(data.categories) ? (data.categories as string[]) : [],
        fullName: typeof data.fullName === "string" ? data.fullName : "",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ loading: false, error: msg });
      throw err instanceof Error ? err : new Error(msg);
    }
  }, []);

  return { ...state, verify };
}

/**
 * Loads the bookable vehicles for the wizard. Fetches when the wizard opens and exposes
 * `reload` so the vehicle picker can refetch on demand (e.g. when its dropdown is opened,
 * or to retry after a failed load). Stale responses are ignored via a request id so a slow
 * earlier request can't overwrite a newer one.
 */
export function useAvailableCars(enabled: boolean) {
  const [cars, setCars] = useState<AdminCarOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("cars")
        .select("id, name, brand, model, base_price_per_hour, base_price_per_day, base_price_per_month, image_url, is_available, deposit_amount")
        .eq("is_available", true)
        .order("name");

      if (requestId !== requestIdRef.current) return;
      if (error) throw error;
      setCars((data || []) as AdminCarOption[]);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Failed to load vehicles:", err);
      setCars([]);
      setError(err instanceof Error ? err.message : "Could not load vehicles. Please try again.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  return { cars, loading, error, reload };
}

/** Mutation wrapper for admin-create-booking. */
export function useAdminCreateBooking() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    data: CreateBookingResponse | null;
  }>({ loading: false, error: null, data: null });

  const createBooking = useCallback(async (payload: CreateBookingPayload) => {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await supabase.functions.invoke("admin-create-booking", {
        body: payload,
      });
      if (res.error) throw await extractEdgeError(res.error, res.data);
      const result = res.data as CreateBookingResponse;
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ loading: false, error: msg, data: null });
      throw err instanceof Error ? err : new Error(msg);
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null });
  }, []);

  return { ...state, createBooking, reset };
}

/**
 * Sends the Stripe invoice for an already-created booking (the admin "book on behalf"
 * contract flow creates the booking first via create-booking + booking-contract). Uses
 * the authenticated admin client so admin-create-booking can authorize the caller.
 */
export async function adminSendInvoice(
  bookingId: string,
  language: "en" | "no",
): Promise<CreateBookingResponse> {
  const res = await supabase.functions.invoke("admin-create-booking", { body: { bookingId, language } });
  if (res.error) throw await extractEdgeError(res.error, res.data);
  return res.data as CreateBookingResponse;
}

/**
 * Fast client-side precheck used by the Details -> Next button.
 * Mirrors backend overlap semantics for statuses that reserve a car.
 */
export async function precheckCarAvailability(params: {
  carId: string;
  startDateTimeIso: string;
  endDateTimeIso: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: car, error: carErr } = await supabase
    .from("cars")
    .select("id, is_available")
    .eq("id", params.carId)
    .maybeSingle();

  if (carErr) return { ok: false, reason: carErr.message };
  if (!car?.is_available) {
    return { ok: false, reason: "Selected car is not available." };
  }

  // This browser's own in-progress hold (created when the admin reached the Review step)
  // must not count against itself when stepping back and forth. The Review step supersedes
  // it by key; here we just exclude it so the precheck doesn't flag a false "already booked".
  let ownBookingId: string | null = null;
  try {
    // Mirror of ADMIN_REQUEST_KEY in ./use-admin-contract.ts.
    const raw = localStorage.getItem("admin_booking_request_state");
    if (raw) ownBookingId = (JSON.parse(raw) as { bookingId?: string })?.bookingId ?? null;
  } catch {
    ownBookingId = null;
  }

  let overlapQuery = supabase
    .from("bookings")
    .select("id")
    .eq("car_id", params.carId)
    .in("status", ["pending", "confirmed", "active"])
    // Half-open overlap check: [start, end)
    .lt("start_datetime", params.endDateTimeIso)
    .gt("end_datetime", params.startDateTimeIso)
    .limit(1);
  if (ownBookingId) overlapQuery = overlapQuery.neq("id", ownBookingId);

  const { data: overlap, error: overlapErr } = await overlapQuery;

  if (overlapErr) return { ok: false, reason: overlapErr.message };
  if (overlap && overlap.length > 0) {
    return { ok: false, reason: "Car is already booked in the selected time window." };
  }

  return { ok: true };
}

/**
 * Pricing for the admin wizard. Delegates to the shared engine so the admin preview matches
 * the customer flow and the authoritative server calculation exactly (hourly / daily /
 * calendar-month pricing, 25% driver surcharge). `start`/`end` are the real Oslo instants.
 */
export function computePricing(
  start: Date | null,
  end: Date | null,
  car: AdminCarOption | null,
  deliveryFee: number,
  withDriver = false,
  pricingMode?: "flat-rate" | "daily-basis" | "monthly-basis"
): AdminBookingPricing | null {
  if (!start || !end || !car) return null;
  if (end.getTime() <= start.getTime()) return null;

  const mode: "flat-rate" | "daily-basis" | "monthly-basis" =
    pricingMode ?? (end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000 ? "daily-basis" : "flat-rate");

  const p = calculateBookingPricing({
    car: {
      base_price_per_hour: car.base_price_per_hour,
      base_price_per_day: car.base_price_per_day,
      base_price_per_month: car.base_price_per_month,
      deposit_amount: car.deposit_amount,
    },
    start,
    end,
    mode,
    withDriver,
    deliveryFee: deliveryFee || 0,
  });

  return {
    durationHours: p.rentalHours,
    rentalDays: p.rentalDays,
    rentalMonths: p.rentalMonths,
    rentalLeftoverDays: p.rentalLeftoverDays,
    rentalLeftoverHours: p.rentalLeftoverHours,
    basePrice: p.basePrice,
    deliveryFee: p.deliveryFee,
    depositAmount: p.depositAmount,
    vatAmount: 0,
    driverSurcharge: p.driverSurcharge,
    totalPrice: p.totalPrice,
  };
}

export function formatNOK(amount: number) {
  return new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function toDateTimeLocalInputValue(d: Date) {
  // `YYYY-MM-DDTHH:mm` in the browser's local time — suitable for <input type="datetime-local" />.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * supabase-js wraps all non-2xx responses in a generic `FunctionsHttpError`
 * with the message "Edge Function returned a non-2xx status code". The real
 * error body is on `err.context` as a `Response`. We unwrap it here so the UI
 * can show the actual reason (e.g. "relation v_admin_eligible_customers does
 * not exist").
 */
async function extractEdgeError(err: unknown, fallbackData: unknown): Promise<Error> {
  try {
    const anyErr = err as { context?: Response | { json?: () => Promise<unknown> } } | undefined;
    const ctx = anyErr?.context;
    if (ctx && typeof (ctx as Response).json === "function") {
      const body = await (ctx as Response).json();
      const msg =
        (body && typeof body === "object" &&
          ((body as Record<string, unknown>).reason ||
            (body as Record<string, unknown>).error ||
            (body as Record<string, unknown>).message)) ||
        (err instanceof Error ? err.message : "Edge function error");
      const e = new Error(String(msg));
      (e as Error & { body?: unknown }).body = body;
      return e;
    }
  } catch {
    // fall through
  }
  if (fallbackData && typeof fallbackData === "object") {
    const f = fallbackData as Record<string, unknown>;
    const msg = f.reason || f.error || f.message;
    if (msg) return new Error(String(msg));
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Re-export formatting helpers grouped for components that only need a single import. */
export const adminBookingUtils = {
  computePricing,
  formatNOK,
  toDateTimeLocalInputValue,
  parseDateTimeLocal,
};

// Re-export types via a separate import to avoid circular re-export linting noise.
export type {
  AdminBookingPricing,
  AdminCarOption,
  CreateBookingPayload,
  CreateBookingResponse,
};
