import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AdminBookingPricing,
  AdminCarOption,
  CreateBookingPayload,
  CreateBookingResponse,
  EligibleCustomer,
  EligibleCustomerPage,
} from "./types";

/** Debounced search against the admin-search-customers edge function. */
export function useEligibleCustomers(
  query: string,
  page = 0,
  pageSize = 20,
  enabled = true,
  accessToken?: string | null
) {
  const [state, setState] = useState<{
    data: EligibleCustomerPage | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });

  const debouncedQ = useDebouncedValue(query, 300);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    if (!accessToken) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const id = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        let res = await supabase.functions.invoke("admin-search-customers", {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { q: debouncedQ, page, pageSize },
        });
        const unauthorized =
          !!res.error &&
          String(
            (res.data as Record<string, unknown> | null)?.error ??
              (res.error as { message?: string } | null)?.message ??
              ""
          ).toLowerCase().includes("unauthorized");
        if (unauthorized) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          const refreshedToken = refreshed.session?.access_token;
          if (refreshedToken) {
            res = await supabase.functions.invoke("admin-search-customers", {
              headers: { Authorization: `Bearer ${refreshedToken}` },
              body: { q: debouncedQ, page, pageSize },
            });
          }
        }
        if (id !== reqIdRef.current) return; // stale
        if (res.error) throw await extractEdgeError(res.error, res.data);
        setState({ data: res.data as EligibleCustomerPage, loading: false, error: null });
      } catch (err) {
        if (id !== reqIdRef.current) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [debouncedQ, page, pageSize, enabled, accessToken]);

  return state;
}

/** Fetches available cars once when the wizard opens. */
export function useAvailableCars(enabled: boolean) {
  const [cars, setCars] = useState<AdminCarOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("id, name, brand, model, base_price_per_hour, base_price_per_day, image_url, is_available, deposit_amount")
        .eq("is_available", true)
        .order("name");

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setCars([]);
      } else {
        setCars((data || []) as AdminCarOption[]);
        setError(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { cars, loading, error };
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

  const { data: overlap, error: overlapErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("car_id", params.carId)
    .in("status", ["pending", "confirmed", "active"])
    // Half-open overlap check: [start, end)
    .lt("start_datetime", params.endDateTimeIso)
    .gt("end_datetime", params.startDateTimeIso)
    .limit(1);

  if (overlapErr) return { ok: false, reason: overlapErr.message };
  if (overlap && overlap.length > 0) {
    return { ok: false, reason: "Car is already booked in the selected time window." };
  }

  return { ok: true };
}

/** Pure pricing helper — kept in sync with Norwegian 25% VAT. */
export function computePricing(
  start: Date | null,
  end: Date | null,
  car: AdminCarOption | null,
  deliveryFee: number,
  withDriver = false
): AdminBookingPricing | null {
  if (!start || !end || !car) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  const hours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));

  let basePrice: number;
  if (hours >= 24) {
    const days = Math.ceil(hours / 24);
    basePrice = days * Number(car.base_price_per_day);
  } else {
    basePrice = hours * Number(car.base_price_per_hour);
  }

  const depositAmount = round2(Number(car.deposit_amount ?? 0));
  const vatAmount = 0;
  const subtotal = round2(basePrice + (deliveryFee || 0) + depositAmount);
  // Driver surcharge applies to base price only.
  const driverSurcharge = withDriver ? round2(basePrice * 0.25) : 0;
  const totalPrice = round2(subtotal + driverSurcharge);

  return {
    durationHours: hours,
    basePrice: round2(basePrice),
    deliveryFee: round2(deliveryFee || 0),
    depositAmount,
    vatAmount,
    driverSurcharge,
    totalPrice,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
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
  EligibleCustomer,
  EligibleCustomerPage,
};
