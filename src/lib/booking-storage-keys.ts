import { STORAGE_KEYS } from "@/components/booking/customer-form";

/**
 * localStorage keys used to persist an in-progress booking (BankID auth, contract
 * signing, restore state) across redirects to BankID/Signicat and Stripe.
 *
 * Cleared once a booking reaches a terminal state (paid or cancelled) so a later
 * visit to the home page doesn't restore a stale booking dialog.
 */
export const BOOKING_FLOW_STORAGE_KEYS = Object.values(STORAGE_KEYS);
