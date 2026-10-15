import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls an edge function built on supabase/functions/_shared/http.ts. Errors carry the
 * server's stable `code` and user-safe `message`; nothing else from the response is
 * surfaced.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Network problems and temporary outages are worth retrying. */
  get retryable(): boolean {
    return this.code === "NETWORK_ERROR" || (this.status !== undefined && this.status >= 500);
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Calls an edge function. `client` defaults to the signed-in app client; pass an
 * anonymous client (no session) when the call must NOT carry the caller's JWT — e.g.
 * the admin "book on behalf" contract flow, where the booking belongs to the typed
 * customer, not the signed-in admin.
 */
export async function invoke<T>(name: string, body: object, client: SupabaseClient = supabase): Promise<T> {
  const { data, error } = await client.functions.invoke(name, { body });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    let payload: { error?: { code?: unknown; message?: unknown } & Record<string, unknown> } | null = null;
    try {
      payload = await response.json();
    } catch {
      // Non-JSON error (e.g. gateway): fall back to a generic message.
    }
    const err = payload?.error;
    if (err && typeof err.code === "string" && typeof err.message === "string") {
      const { code, message, ...details } = err;
      throw new ApiError(code, message, response.status, details);
    }
    throw new ApiError("REQUEST_FAILED", GENERIC_MESSAGE, response.status);
  }

  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new ApiError("NETWORK_ERROR", "We couldn't reach the server. Check your connection and try again.");
  }
  throw new ApiError("REQUEST_FAILED", GENERIC_MESSAGE);
}

export const toApiError = (error: unknown): ApiError =>
  error instanceof ApiError ? error : new ApiError("REQUEST_FAILED", GENERIC_MESSAGE);
