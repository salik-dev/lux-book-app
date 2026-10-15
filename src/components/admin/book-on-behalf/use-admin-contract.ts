import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  type BookingAccess,
  createBooking,
  createContract,
  type CreatedBooking,
  emailSignUrl,
  getContract,
  getContractDocument,
  getSigningUrl,
  type PublicContract,
  toApiError,
} from "@/lib/booking-contract-api";

/**
 * Drives the rental-agreement part of the admin "book on behalf" Review step.
 *
 * It reuses the customer contract backend (create-booking + booking-contract). The
 * booking is created with `onBehalf: true` so it belongs to the typed customer, never
 * to the signed-in admin, even though the call carries the admin's session. The customer
 * signs later from the emailed link, so there is no redirect/return handling here.
 */

export type AdminContractBusy = "booking" | "loading" | "creating" | "linking" | "emailing" | "opening" | null;

export interface AdminContractInput {
  carId: string;
  startDateTime: string;
  endDateTime: string;
  seatPricingMode: "flat-rate" | "daily-basis" | "monthly-basis";
  pickupLocation: string;
  deliveryLocation: string | null;
  decorationRequired: boolean;
  withDriver: boolean;
  customer: {
    firstName: string;
    lastName: string;
    nin: string;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    city: string;
    bookingForCompany: boolean;
    orgName: string | null;
    orgNo: string | null;
  };
}

/** Namespaced so it never collides with the customer flow's BOOKING_REQUEST_KEY. */
const ADMIN_REQUEST_KEY = "admin_booking_request_state";
const ACCESS_KEY_RE = /^[A-Za-z0-9_-]{43}$/;

interface StoredRequest {
  requestId: string;
  accessKey: string;
  fingerprint: string;
  bookingId?: string;
}

function readStoredRequest(): StoredRequest | null {
  try {
    const raw = localStorage.getItem(ADMIN_REQUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredRequest>) : null;
    return parsed &&
        typeof parsed.requestId === "string" &&
        typeof parsed.fingerprint === "string" &&
        typeof parsed.accessKey === "string" &&
        ACCESS_KEY_RE.test(parsed.accessKey)
      ? (parsed as StoredRequest)
      : null;
  } catch {
    return null;
  }
}

function writeStoredRequest(value: StoredRequest) {
  try {
    localStorage.setItem(ADMIN_REQUEST_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: idempotency degrades to "create a fresh booking", which is fine.
  }
}

/** 256-bit random key, base64url without padding (43 characters). */
function newAccessKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRequest(input: AdminContractInput) {
  return {
    onBehalf: true,
    carId: input.carId,
    startDateTime: new Date(input.startDateTime).toISOString(),
    endDateTime: new Date(input.endDateTime).toISOString(),
    seatPricingMode: input.seatPricingMode,
    pickupLocation: input.pickupLocation,
    deliveryLocation: input.deliveryLocation ?? null,
    // The admin form has a single "decoration required" flag; map it onto one line so the
    // booking's decoration_require ends up true. (create-booking: require = flowers||ribbon||carpets.)
    decorationFlowers: Boolean(input.decorationRequired),
    decorationRibbon: false,
    decorationRedCarpets: false,
    decorationDriverNeed: Boolean(input.withDriver),
    customer: {
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      nin: input.customer.nin || null,
      email: input.customer.email,
      phone: input.customer.phone,
      address: input.customer.address,
      postalCode: input.customer.postalCode,
      city: input.customer.city,
      bookingForCompany: Boolean(input.customer.bookingForCompany),
      orgName: input.customer.orgName ?? null,
      orgNo: input.customer.orgNo ?? null,
    },
  } as const;
}

async function fingerprintOf(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useAdminBookingContract(input: AdminContractInput, enabled: boolean) {
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [access, setAccess] = useState<BookingAccess | null>(null);
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [busy, setBusy] = useState<AdminContractBusy>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [bookingError, setBookingError] = useState<ApiError | null>(null);
  const [signLink, setSignLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Create (or reuse) the guest booking, then prepare its contract.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      setBusy("booking");
      setBookingError(null);
      setError(null);
      let created: CreatedBooking | null = null;
      try {
        const request = buildRequest(input);
        const fingerprint = await fingerprintOf(request);

        const submit = async (allowReset: boolean): Promise<{ booking: CreatedBooking; access: BookingAccess }> => {
          const stored = readStoredRequest();
          const sameRequest = stored?.fingerprint === fingerprint;
          const next: StoredRequest = sameRequest
            ? stored
            : { requestId: crypto.randomUUID(), accessKey: newAccessKey(), fingerprint };
          writeStoredRequest(next);
          try {
            const result = await createBooking({
              ...request,
              requestId: next.requestId,
              accessKey: next.accessKey,
              supersedesBookingId: !sameRequest ? stored?.bookingId ?? null : null,
              supersedesAccessKey: !sameRequest ? stored?.accessKey ?? null : null,
            });
            writeStoredRequest({ ...next, bookingId: result.bookingId });
            return { booking: result, access: { bookingId: result.bookingId, accessKey: next.accessKey } };
          } catch (err) {
            if (allowReset && err instanceof ApiError && err.code === "REQUEST_CONFLICT") {
              localStorage.removeItem(ADMIN_REQUEST_KEY);
              return submit(false);
            }
            throw err;
          }
        };

        const result = await submit(true);
        created = result.booking;
        if (cancelled) return;
        setBooking(created);
        setAccess(result.access);

        setBusy("loading");
        let { contract: current } = await getContract(result.access);
        if (cancelled) return;
        setContract(current);

        // Prepare the contract so the admin can immediately copy / send the signing link.
        if (!current) {
          setBusy("creating");
          const { contract: prepared } = await createContract(result.access);
          if (cancelled) return;
          current = prepared;
          setContract(current);
        }
      } catch (err) {
        if (cancelled) return;
        if (created) setError(toApiError(err));
        else setBookingError(toApiError(err));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, attempt, input]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const copySignLink = useCallback(async (): Promise<string | null> => {
    if (!access) return null;
    setError(null);
    setBusy("linking");
    try {
      const { url } = await getSigningUrl(access);
      if (mounted.current) setSignLink(url);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard may be blocked; the URL is still returned/shown so the admin can copy it manually.
      }
      return url;
    } catch (err) {
      if (mounted.current) setError(toApiError(err));
      return null;
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [access]);

  const emailSignLink = useCallback(async (): Promise<boolean> => {
    if (!access) return false;
    setError(null);
    setBusy("emailing");
    try {
      const { sentTo: to } = await emailSignUrl(access);
      if (mounted.current) setSentTo(to);
      return true;
    } catch (err) {
      if (mounted.current) setError(toApiError(err));
      return false;
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [access]);

  const openDocument = useCallback(async () => {
    if (!access) return;
    setError(null);
    const tab = window.open("", "_blank");
    setBusy("opening");
    try {
      const { url } = await getContractDocument(access);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (err) {
      tab?.close();
      if (mounted.current) setError(toApiError(err));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [access]);

  const refresh = useCallback(async () => {
    if (!access) return;
    setError(null);
    setBusy("loading");
    try {
      const { contract: current } = await getContract(access);
      if (mounted.current) setContract(current);
    } catch (err) {
      if (mounted.current) setError(toApiError(err));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [access]);

  return {
    booking,
    access,
    contract,
    busy,
    error,
    bookingError,
    signLink,
    sentTo,
    retry,
    copySignLink,
    emailSignLink,
    openDocument,
    refresh,
  };
}

export type AdminBookingContractState = ReturnType<typeof useAdminBookingContract>;
