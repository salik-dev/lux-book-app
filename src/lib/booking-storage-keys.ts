import { STORAGE_KEYS } from "@/components/booking/customer-form";

/**
 * Idempotency state for the server-created booking (request id + fingerprint of the
 * details it was created from + booking id). Survives the redirect to Idura signing
 * so returning to the flow reuses the same booking and contract.
 */
export const BOOKING_REQUEST_KEY = "booking_request_state";

/**
 * localStorage keys used to persist an in-progress booking (BankID auth, contract
 * signing, restore state) across redirects to BankID/Idura and Stripe.
 *
 * Cleared once a booking reaches a terminal state (paid or cancelled) so a later
 * visit to the home page doesn't restore a stale booking dialog.
 */
export const BOOKING_FLOW_STORAGE_KEYS = [...Object.values(STORAGE_KEYS), BOOKING_REQUEST_KEY];
