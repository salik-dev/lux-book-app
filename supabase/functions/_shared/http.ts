/**
 * Request/response helpers for edge functions.
 *
 * Errors returned to the browser carry a stable `code` and a user-safe `message`
 * only. Technical details (provider responses, stack traces, SQL errors) are written
 * to the function log and never sent to the client.
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
    /** Extra non-sensitive data for the client (e.g. names of missing fields). */
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "HttpError";
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: HttpError): Response {
  return json({ error: { code: error.code, message: error.userMessage, ...(error.details ?? {}) } }, error.status);
}

/** Logs a structured line. Callers must not pass personal data, tokens or document content. */
export function createLogger(scope: string) {
  const write = (level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) => {
    const line = JSON.stringify({ level, scope, event, ...(data ?? {}) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
    warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
    error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** Reduces an unknown error to loggable, non-sensitive fields. */
export function describeError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown; code?: unknown };
    return {
      errorName: typeof e.name === "string" ? e.name : undefined,
      errorCode: typeof e.code === "string" ? e.code : undefined,
      errorMessage: typeof e.message === "string" ? e.message.slice(0, 300) : undefined,
    };
  }
  return { errorMessage: String(error).slice(0, 300) };
}

const MAX_BODY_BYTES = 32 * 1024;

export async function readJsonBody(req: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "INVALID_JSON", "The request could not be read.");
  }
}

/**
 * Wraps a POST handler with CORS preflight, method check and error mapping.
 */
export function handlePost(scope: string, handler: (req: Request, log: Logger) => Promise<Response>) {
  const log = createLogger(scope);
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") {
      return errorResponse(new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed."));
    }
    try {
      return await handler(req, log);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status >= 500) log.error("request_failed", { code: error.code });
        return errorResponse(error);
      }
      log.error("unhandled_error", describeError(error));
      return errorResponse(new HttpError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    }
  };
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new HttpError(500, "SERVER_MISCONFIGURED", "The service is temporarily unavailable.");
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

/**
 * Escapes HTML special characters for safe interpolation into email/markup templates.
 * Lives here (a dependency-free module) so callers can escape without pulling in the
 * mailer's heavy `nodemailer` graph at boot.
 */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
