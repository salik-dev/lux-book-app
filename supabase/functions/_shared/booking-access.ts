/**
 * Booking access keys for guest checkout.
 *
 * The browser generates a random 256-bit key (base64url, 43 chars) when it starts a
 * booking and sends it to `create-booking`. Only its SHA-256 hash is stored
 * (`bookings.access_key_hash`). Every later call for that booking (contract, signing
 * link, document, payment) must present the key, so knowing a booking id is not
 * enough to act on it.
 */

import { HttpError } from "./http.ts";

const ACCESS_KEY_RE = /^[A-Za-z0-9_-]{43}$/;

export const isAccessKey = (value: unknown): value is string => typeof value === "string" && ACCESS_KEY_RE.test(value);

export async function hashAccessKey(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True only when the key's hash matches the stored one. A missing hash never matches. */
export async function accessKeyMatches(key: unknown, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash || !isAccessKey(key)) return false;
  return timingSafeEqualHex(await hashAccessKey(key), storedHash);
}

/** Uniform "not found" so a wrong key doesn't reveal that the booking exists. */
export const bookingNotFound = () => new HttpError(404, "BOOKING_NOT_FOUND", "We couldn't find this booking. Please start a new booking.");
