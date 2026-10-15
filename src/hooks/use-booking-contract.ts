import { useCallback, useEffect, useRef, useState } from "react";
import type { BookingData, CustomerData } from "@/@types/data";
import { STORAGE_KEYS } from "@/components/booking/customer-form";
import {
  ApiError,
  type BookingAccess,
  createBooking,
  createContract,
  type CreatedBooking,
  getContract,
  getContractDocument,
  getSigningUrl,
  type PublicContract,
  startCheckout,
  toApiError,
} from "@/lib/booking-contract-api";
import { BOOKING_REQUEST_KEY } from "@/lib/booking-storage-keys";

/**
 * Drives the contract part of the "Contract and payment" step:
 *   server-priced booking -> contract (PDF + Idura order) -> renter signs -> payment.
 *
 * The server is the source of truth for signing status; nothing here can unlock
 * payment on its own (create-payment re-checks the contract).
 */

export type ContractBusy = "booking" | "loading" | "creating" | "signing" | "opening" | "paying" | null;

const RETURN_PARAM = "contractSign";
const RETURN_BOOKING_PARAM = "bookingId";
/** After returning from Idura the webhook may lag slightly behind the redirect. */
const CONFIRM_POLL_INTERVAL_MS = 2500;
const CONFIRM_POLL_ATTEMPTS = 12;
const RESTARTABLE: PublicContract["status"][] = ["failed", "expired", "rejected"];

/**
 * Persisted across the redirect to Idura so returning reuses the same booking.
 * `accessKey` is the secret that proves this browser owns the booking (guest checkout).
 */
interface StoredRequest {
  requestId: string;
  accessKey: string;
  fingerprint: string;
  bookingId?: string;
}

const ACCESS_KEY_RE = /^[A-Za-z0-9_-]{43}$/;

function readStoredRequest(): StoredRequest | null {
  try {
    const raw = localStorage.getItem(BOOKING_REQUEST_KEY);
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
  localStorage.setItem(BOOKING_REQUEST_KEY, JSON.stringify(value));
}

/** 256-bit random key, base64url without padding (43 characters). */
function newAccessKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRequest(bookingData: BookingData, customerData: CustomerData) {
  return {
    carId: String(bookingData.car.id),
    startDateTime: new Date(bookingData.startDateTime).toISOString(),
    endDateTime: new Date(bookingData.endDateTime).toISOString(),
    seatPricingMode: bookingData.seatPricingMode ?? "flat-rate",
    pickupLocation: bookingData.pickupLocation,
    deliveryLocation: bookingData.deliveryLocation ?? null,
    decorationFlowers: Boolean(bookingData.decorationFlowers),
    decorationRibbon: Boolean(bookingData.decorationRibbon),
    decorationRedCarpets: Boolean(bookingData.decorationRedCarpets),
    decorationDriverNeed: Boolean(bookingData.decorationDriverNeed ?? bookingData.withDriver),
    customer: {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      nin: customerData.nin || null,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address,
      postalCode: customerData.postalCode,
      city: customerData.city,
      bookingForCompany: Boolean(customerData.bookingForCompany),
      orgName: customerData.orgName ?? null,
      orgNo: customerData.orgNo ?? null,
    },
  } as const;
}

async function fingerprintOf(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lets the home page reopen this step after the redirect back from Idura. */
function saveRestoreState(bookingData: BookingData, customerData: CustomerData) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.bookingRestoreState,
      JSON.stringify({ step: 3, bookingData, customerData: { ...customerData, driverLicenseFile: undefined } }),
    );
  } catch {
    // Storage unavailable (private mode): the customer can reopen the booking manually.
  }
}

/** Booking id from the "returned from signing" marker Idura redirects back with, if any. */
function readReturnMarker(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(RETURN_PARAM) === "return" ? params.get(RETURN_BOOKING_PARAM) : null;
}

function clearReturnMarker() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RETURN_PARAM)) return;
  url.searchParams.delete(RETURN_PARAM);
  url.searchParams.delete(RETURN_BOOKING_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

export function useBookingContract(bookingData: BookingData, customerData: CustomerData) {
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const [access, setAccess] = useState<BookingAccess | null>(null);
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [busy, setBusy] = useState<ContractBusy>("booking");
  const [error, setError] = useState<ApiError | null>(null);
  const [bookingError, setBookingError] = useState<ApiError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Read once per mount (pure, so StrictMode's double render is harmless).
  const [returnedFor] = useState(readReturnMarker);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 1. Create (or reuse) the server-priced booking, then load its contract.
  useEffect(() => {
    let cancelled = false;
    clearReturnMarker();

    (async () => {
      setBusy("booking");
      setBookingError(null);
      let created: CreatedBooking | null = null;
      try {
        const request = buildRequest(bookingData, customerData);
        const fingerprint = await fingerprintOf(request);

        const submit = async (allowReset: boolean): Promise<{ booking: CreatedBooking; access: BookingAccess }> => {
          const stored = readStoredRequest();
          // Returning from Idura for a specific booking: always resume that exact booking so a
          // harmless fingerprint drift can't spin up a new (conflicting) booking and throw away
          // the contract the customer just signed.
          const resuming = returnedFor != null && stored?.bookingId === returnedFor;
          const sameRequest = stored != null && (stored.fingerprint === fingerprint || resuming);
          const next: StoredRequest = sameRequest
            ? stored
            : { requestId: crypto.randomUUID(), accessKey: newAccessKey(), fingerprint };
          // Persist before calling so a retry after a lost response is idempotent.
          writeStoredRequest(next);
          try {
            const result = await createBooking({
              ...request,
              requestId: next.requestId,
              accessKey: next.accessKey,
              // Release this browser's previous attempt when the details changed.
              supersedesBookingId: !sameRequest ? stored?.bookingId ?? null : null,
              supersedesAccessKey: !sameRequest ? stored?.accessKey ?? null : null,
            });
            writeStoredRequest({ ...next, bookingId: result.bookingId });
            return { booking: result, access: { bookingId: result.bookingId, accessKey: next.accessKey } };
          } catch (err) {
            // The stored request no longer matches the server's record: start a fresh one once.
            if (allowReset && err instanceof ApiError && err.code === "REQUEST_CONFLICT") {
              localStorage.removeItem(BOOKING_REQUEST_KEY);
              return submit(false);
            }
            throw err;
          }
        };

        const result = await submit(true);
        created = result.booking;
        const bookingAccess = result.access;
        if (cancelled) return;
        setBooking(created);
        setAccess(bookingAccess);

        setBusy("loading");
        let { contract: current } = await getContract(bookingAccess);
        if (cancelled) return;
        setContract(current);

        // 2. Back from Idura: wait for the signature to be confirmed server-side.
        if (returnedFor === created.bookingId && current && (current.status === "signature_pending" || current.status === "generating")) {
          setConfirming(true);
          setBusy(null);
          for (let i = 0; i < CONFIRM_POLL_ATTEMPTS && !cancelled; i++) {
            await new Promise((resolve) => setTimeout(resolve, CONFIRM_POLL_INTERVAL_MS));
            if (cancelled) return;
            ({ contract: current } = await getContract(bookingAccess));
            if (cancelled) return;
            setContract(current);
            if (!current || (current.status !== "signature_pending" && current.status !== "generating")) break;
          }
          if (!cancelled) setConfirming(false);
        }

        // 3. First time on this step with no contract yet: prepare it now so the card shows a
        //    "Contract ready" state and the Review & sign / Preview buttons are enabled without
        //    an extra click. Idempotent server-side, so a re-mount won't create a second order.
        if (!cancelled && !current && returnedFor !== created.bookingId) {
          setBusy("creating");
          const { contract: prepared } = await createContract(bookingAccess);
          if (cancelled) return;
          current = prepared;
          setContract(current);
        }
      } catch (err) {
        if (cancelled) return;
        // Once the booking exists, failures concern the contract and are shown in the card.
        if (created) setError(toApiError(err));
        else setBookingError(toApiError(err));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run only when the details the booking is created from change, or on retry.
  }, [attempt, bookingData, customerData, returnedFor]);

  const retryBooking = useCallback(() => setAttempt((n) => n + 1), []);

  const ensureContract = useCallback(async (): Promise<PublicContract> => {
    if (!access) throw new ApiError("BOOKING_NOT_READY", "Your booking is still being prepared. Please wait a moment.");
    if (contract && !RESTARTABLE.includes(contract.status)) return contract;
    const { contract: created } = await createContract(access);
    if (mounted.current) setContract(created);
    return created;
  }, [access, contract]);

  /** Prepares the contract if needed and sends the customer to Idura to review and sign it. */
  const reviewAndSign = useCallback(async () => {
    if (!access) return;
    setError(null);
    setBusy("signing");
    try {
      const current = await ensureContract();
      if (current.status !== "signature_pending") {
        setBusy(null);
        return;
      }
      const { url } = await getSigningUrl(access);
      saveRestoreState(bookingData, customerData);
      window.location.assign(url);
      // Keep the busy state while the browser navigates away.
    } catch (err) {
      if (mounted.current) {
        setError(toApiError(err));
        setBusy(null);
        // The server may know something we don't (e.g. already signed, expired).
        getContract(access).then(({ contract: c }) => mounted.current && setContract(c)).catch(() => undefined);
      }
    }
  }, [access, bookingData, customerData, ensureContract]);

  /** Opens the contract PDF (signed copy once available) in a new tab. */
  const openDocument = useCallback(async () => {
    if (!access) return;
    setError(null);
    // Open synchronously within the click so popup blockers allow it.
    const tab = window.open("", "_blank");
    setBusy("opening");
    try {
      await ensureContract();
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
  }, [access, ensureContract]);

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

  /** Starts Stripe Checkout. The server refuses unless the contract is signed. */
  const pay = useCallback(async () => {
    if (!access) return;
    setError(null);
    setBusy("paying");
    try {
      const { url } = await startCheckout(access);
      window.location.assign(url);
    } catch (err) {
      if (mounted.current) {
        setError(toApiError(err));
        setBusy(null);
      }
    }
  }, [access]);

  return {
    booking,
    bookingError,
    contract,
    busy,
    error,
    confirming,
    canPay: Boolean(contract?.canPay) && busy !== "paying",
    retryBooking,
    reviewAndSign,
    openDocument,
    refresh,
    pay,
    dismissError: () => setError(null),
  };
}

export type BookingContractState = ReturnType<typeof useBookingContract>;
