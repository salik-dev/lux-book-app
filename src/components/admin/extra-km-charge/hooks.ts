import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreateExtraKmChargePayload {
  bookingId: string;
  extraKmDriven: number;
  chargeAmount: number;
  sendEmail?: boolean;
  language?: "en" | "no";
}

export interface CreateExtraKmChargeResponse {
  ok: true;
  bookingId: string;
  checkoutUrl: string;
  sessionId: string;
  chargeAmount: number;
  originalDepositAmount: number;
}

/**
 * supabase-js wraps all non-2xx edge function responses in a generic error whose real
 * body lives on `err.context` — unwrap it so the sheet can show the actual reason
 * (e.g. "Charge cannot exceed the deposit amount").
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
      return new Error(String(msg));
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

/** Mutation wrapper for create-extra-km-charge. */
export function useCreateExtraKmCharge() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    data: CreateExtraKmChargeResponse | null;
  }>({ loading: false, error: null, data: null });

  const createCharge = useCallback(async (payload: CreateExtraKmChargePayload) => {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await supabase.functions.invoke("create-extra-km-charge", { body: payload });
      if (res.error) throw await extractEdgeError(res.error, res.data);
      const result = res.data as CreateExtraKmChargeResponse;
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ loading: false, error: msg, data: null });
      throw err instanceof Error ? err : new Error(msg);
    }
  }, []);

  const reset = useCallback(() => setState({ loading: false, error: null, data: null }), []);

  return { ...state, createCharge, reset };
}

/** Mutation wrapper for emailing an already-created checkout link. */
export function useSendExtraKmChargeEmail() {
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (bookingId: string, checkoutUrl: string, language: "en" | "no" = "en") => {
      setSending(true);
      try {
        const res = await supabase.functions.invoke("send-booking-email", {
          body: { bookingId, emailType: "extra_km_charge", checkoutUrl, language },
        });
        if (res.error) throw await extractEdgeError(res.error, res.data);
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { send, sending };
}

export function formatNOK(amount: number) {
  return new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(amount);
}
