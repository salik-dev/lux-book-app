import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, invoke, toApiError } from "@/lib/edge-function";

/**
 * Client for the booking/contract/payment edge functions
 * (create-booking, booking-contract, create-payment).
 *
 * Errors carry the server's stable `code` and user-safe `message`; nothing else from
 * the response is surfaced.
 */

export type ContractStatus =
  | "generating"
  | "signature_pending"
  | "renter_signed"
  | "signed"
  | "rejected"
  | "expired"
  | "failed";

export interface PublicContract {
  contractId: string;
  bookingId: string;
  status: ContractStatus;
  canPay: boolean;
  renterSignedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  hasSignedDocument: boolean;
  failureCode: string | null;
}

export interface CreatedBooking {
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  totalPrice: number;
  depositAmount: number;
  totalExcludingDeposit: number;
}

/**
 * Proof of ownership for guest checkout: the booking id plus the secret key this
 * browser generated when it created the booking. Required by every booking call.
 */
export interface BookingAccess {
  bookingId: string;
  accessKey: string;
}

export interface CreateBookingRequest {
  requestId: string;
  accessKey: string;
  /** Admin "book on behalf": create the booking for `customer`, not the signed-in caller. */
  onBehalf?: boolean;
  supersedesBookingId?: string | null;
  supersedesAccessKey?: string | null;
  carId: string;
  startDateTime: string;
  endDateTime: string;
  seatPricingMode: "flat-rate" | "daily-basis" | "monthly-basis";
  pickupLocation: string;
  deliveryLocation?: string | null;
  decorationFlowers: boolean;
  decorationRibbon: boolean;
  decorationRedCarpets: boolean;
  decorationDriverNeed: boolean;
  customer: {
    firstName: string;
    lastName: string;
    nin?: string | null;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    city: string;
    bookingForCompany: boolean;
    orgName?: string | null;
    orgNo?: string | null;
  };
}

export { ApiError, toApiError };

/**
 * All contract calls accept an optional `client`. The admin "book on behalf" flow passes
 * an anonymous client so the request carries no admin JWT (the booking belongs to the
 * typed customer, not the signed-in admin). Omit it elsewhere to use the app client.
 */
export const createBooking = (request: CreateBookingRequest, client?: SupabaseClient) =>
  invoke<CreatedBooking>("create-booking", request, client);

export const getContract = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ contract: PublicContract | null; stale?: boolean }>("booking-contract", { action: "status", ...access }, client);

export const createContract = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ contract: PublicContract }>("booking-contract", { action: "create", ...access }, client);

export const getSigningUrl = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ url: string }>("booking-contract", { action: "sign-url", ...access }, client);

export const emailSignUrl = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ ok: true; sentTo: string }>("booking-contract", { action: "email-sign-url", ...access }, client);

export const getContractDocument = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ url: string; signed: boolean }>("booking-contract", { action: "document", ...access }, client);

export const startCheckout = (access: BookingAccess, client?: SupabaseClient) =>
  invoke<{ url: string; sessionId: string }>("create-payment", access, client);
