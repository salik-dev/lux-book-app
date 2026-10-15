/**
 * Idura webhook authentication and parsing.
 * Docs: https://docs.idura.app/signatures/webhooks/configuration/
 *
 * Idura sends `X-Criipto-Signature`: base64(HMAC-SHA256(secret, raw UTF-8 body)),
 * where the secret is the base64 blob we supplied when creating the order.
 */

export const WEBHOOK_SIGNATURE_HEADER = "X-Criipto-Signature";

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Validates the configured secret: base64 encoding 256–512 bits, as Idura requires. */
export function parseWebhookSecret(secretBase64: string | undefined): Uint8Array<ArrayBuffer> {
  if (!secretBase64) throw new Error("IDURA_WEBHOOK_SECRET is not set");
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = decodeBase64(secretBase64.trim());
  } catch {
    throw new Error("IDURA_WEBHOOK_SECRET must be base64");
  }
  if (bytes.length < 32 || bytes.length > 64) throw new Error("IDURA_WEBHOOK_SECRET must be 32-64 bytes");
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function computeWebhookSignature(
  secret: Uint8Array<ArrayBuffer>,
  body: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
}

export async function verifyWebhookSignature(
  secret: Uint8Array<ArrayBuffer>,
  body: Uint8Array<ArrayBuffer>,
  headerValue: string | null,
): Promise<boolean> {
  if (!headerValue) return false;
  let provided: Uint8Array;
  try {
    provided = decodeBase64(headerValue.trim());
  } catch {
    return false;
  }
  const expected = await computeWebhookSignature(secret, body);
  return timingSafeEqual(expected, provided);
}

export const IDURA_WEBHOOK_EVENTS = [
  "SIGNATORY_SIGNED",
  "SIGNATORY_REJECTED",
  "SIGNATORY_SIGN_ERROR",
  "SIGNATORY_SIGN_LINK_OPENED",
  "SIGNATORY_DOWNLOAD_LINK_OPENED",
  "SIGNATORY_DOCUMENT_STATUS_CHANGED",
  "SIGNATURE_ORDER_EXPIRED",
  "ALL_CURRENT_SIGNATORIES_SIGNED",
  "WEBHOOK_VALIDATION",
] as const;

export type IduraWebhookEventName = (typeof IDURA_WEBHOOK_EVENTS)[number];

export interface IduraWebhookEvent {
  event: IduraWebhookEventName;
  signatureOrderId: string | null;
  signatoryId: string | null;
}

const ID_RE = /^[A-Za-z0-9_\-=:+/.]{1,200}$/;
const optionalId = (value: unknown): string | null => (typeof value === "string" && ID_RE.test(value) ? value : null);

/** Parses and validates the event envelope. Returns null for unknown/malformed payloads. */
export function parseWebhookEvent(payload: unknown): IduraWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  if (typeof raw.event !== "string" || !(IDURA_WEBHOOK_EVENTS as readonly string[]).includes(raw.event)) return null;
  const event = raw.event as IduraWebhookEventName;
  const signatureOrderId = optionalId(raw.signatureOrderId);
  if (event !== "WEBHOOK_VALIDATION" && !signatureOrderId) return null;
  return { event, signatureOrderId, signatoryId: optionalId(raw.signatoryId) };
}

/** Events that can change our contract state and therefore trigger a reconcile. */
export const STATE_CHANGING_EVENTS: ReadonlySet<IduraWebhookEventName> = new Set([
  "SIGNATORY_SIGNED",
  "SIGNATORY_REJECTED",
  "SIGNATORY_SIGN_ERROR",
  "SIGNATURE_ORDER_EXPIRED",
  "ALL_CURRENT_SIGNATORIES_SIGNED",
]);
