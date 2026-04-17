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
export function useEligibleCustomers(query: string, page = 0, pageSize = 20) {
  const [state, setState] = useState<{
    data: EligibleCustomerPage | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: false, error: null });

  const debouncedQ = useDebouncedValue(query, 300);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const id = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const res = await supabase.functions.invoke("admin-search-customers", {
          body: { q: debouncedQ, page, pageSize },
        });
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
  }, [debouncedQ, page, pageSize]);

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
        .select("id, name, brand, model, base_price_per_hour, base_price_per_day, image_url, is_available")
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

/** Pure pricing helper — kept in sync with Norwegian 25% VAT. */
export function computePricing(
  start: Date | null,
  end: Date | null,
  car: AdminCarOption | null,
  deliveryFee: number
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

  const VAT_RATE = 0.25;
  const vatAmount = round2(basePrice * VAT_RATE);
  const totalPrice = round2(basePrice + vatAmount + (deliveryFee || 0));

  return {
    durationHours: hours,
    basePrice: round2(basePrice),
    deliveryFee: round2(deliveryFee || 0),
    vatAmount,
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
