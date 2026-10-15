/**
 * Booking contract lifecycle: creation, persistence and reconciliation with Idura.
 *
 * Idura is the source of truth for signatures. Both the webhook and the status
 * endpoint call `syncContract`, which reads the signature order from Idura and moves
 * the local row forward with conditional updates. That makes duplicate or
 * out-of-order webhooks harmless and lets the app recover if a webhook is missed.
 *
 *   generating -> signature_pending -> renter_signed -> signed
 *        |               |                  |
 *      failed      rejected/expired    rejected/expired
 */

import { findConflicts, holdUntil } from "../availability.ts";
import { accessKeyMatches, bookingNotFound } from "../booking-access.ts";
import { DRIVER_SURCHARGE_RATE, roundCurrency } from "../booking-pricing.ts";
import { describeError, escapeHtml, HttpError, type Logger, requireEnv } from "../http.ts";
import { IduraError, type IduraSignatory, type IduraSignatureOrder, type IduraSignaturesClient } from "../idura/client.ts";
import { encodeBase64, decodeBase64, parseWebhookSecret } from "../idura/webhook.ts";
// The mailer pulls in `nodemailer`; it is imported lazily (see `defaultDeps` below) so the
// heavy dependency never loads at function boot — only when an email is actually sent.
import type { MailMessage } from "../mailer.ts";
import type { AdminClient } from "../supabase.ts";
import { buildContractFields, ContractDataError, type ContractFields } from "./fields.ts";
import { formatContractDateTime, CONTRACT_TIMEZONE } from "./format.ts";
import { ContractRenderError, loadContractAssets, renderContractPdf } from "./pdf.ts";

export type ContractStatus =
  | "generating"
  | "signature_pending"
  | "renter_signed"
  | "signed"
  | "rejected"
  | "expired"
  | "failed";

export const ACTIVE_STATUSES: ContractStatus[] = ["generating", "signature_pending", "renter_signed", "signed"];
/** Payment unlocks once the renter has signed; the broker countersigns afterwards. */
export const PAYABLE_STATUSES: ContractStatus[] = ["renter_signed", "signed"];
const FINAL_STATUSES: ContractStatus[] = ["signed", "rejected", "expired", "failed"];

export const CONTRACTS_BUCKET = "contracts";
const RENTER_REFERENCE = "renter";
const BROKER_REFERENCE = "broker";
/** A row stuck in `generating` this long is treated as an abandoned attempt. */
const GENERATING_TIMEOUT_MS = 3 * 60 * 1000;

export interface ContractRow {
  id: string;
  booking_id: string;
  customer_id: string;
  status: ContractStatus;
  idura_signature_order_id: string | null;
  idura_document_id: string | null;
  renter_signatory_id: string | null;
  broker_signatory_id: string | null;
  contract_amount: number | string;
  unsigned_pdf_path: string | null;
  unsigned_pdf_sha256: string | null;
  signed_pdf_path: string | null;
  signed_pdf_sha256: string | null;
  renter_signed_at: string | null;
  broker_signed_at: string | null;
  signed_at: string | null;
  broker_notified_at: string | null;
  completed_notified_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnedBooking {
  id: string;
  booking_number: string;
  status: string | null;
  start_datetime: string;
  end_datetime: string;
  base_price: number | string | null;
  delivery_fee: number | string | null;
  total_price: number | string;
  booking_deposit: number | string | null;
  with_driver: boolean | null;
  decoration_driver_need: boolean | null;
  client_request_id: string | null;
  customer: {
    id: string;
    user_id: string | null;
    full_name: string;
    phone: string;
    address: string;
    postal_code: string;
    city: string;
  };
  car: { id: string; brand: string; model: string; name: string };
}

/** What the browser is allowed to know about a contract. */
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

export function toPublicContract(row: ContractRow): PublicContract {
  return {
    contractId: row.id,
    bookingId: row.booking_id,
    status: row.status,
    canPay: PAYABLE_STATUSES.includes(row.status),
    renterSignedAt: row.renter_signed_at,
    signedAt: row.signed_at,
    expiresAt: row.expires_at,
    hasSignedDocument: Boolean(row.signed_pdf_path),
    failureCode: row.status === "failed" || row.status === "rejected" || row.status === "expired"
      ? row.failure_reason
      : null,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

const BOOKING_SELECT = `
  id, booking_number, status, start_datetime, end_datetime,
  base_price, delivery_fee, total_price, booking_deposit, with_driver, decoration_driver_need, client_request_id,
  access_key_hash,
  customer:customers!inner ( id, user_id, full_name, phone, address, postal_code, city ),
  car:cars!inner ( id, brand, model, name )
`;

/**
 * Loads a booking only if `accessKey` is the key it was created with (guest checkout,
 * see booking-access.ts). A wrong key is reported as not found so the booking's
 * existence isn't revealed.
 */
export async function loadOwnedBooking(admin: AdminClient, bookingId: string, accessKey: unknown): Promise<OwnedBooking> {
  const { data, error } = await admin.from("bookings").select(BOOKING_SELECT).eq("id", bookingId).maybeSingle();
  if (error) throw error;
  const row = data as unknown as (OwnedBooking & { access_key_hash: string | null }) | null;
  if (!row || !(await accessKeyMatches(accessKey, row.access_key_hash))) throw bookingNotFound();
  const { access_key_hash: _hash, ...booking } = row;
  return booking;
}

export async function getLatestContract(admin: AdminClient, bookingId: string): Promise<ContractRow | null> {
  const { data, error } = await admin
    .from("booking_contracts")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ContractRow | null;
}

async function getActiveContract(admin: AdminClient, bookingId: string): Promise<ContractRow | null> {
  const { data, error } = await admin
    .from("booking_contracts")
    .select("*")
    .eq("booking_id", bookingId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return data as ContractRow | null;
}

async function reload(admin: AdminClient, id: string): Promise<ContractRow> {
  const { data, error } = await admin.from("booking_contracts").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ContractRow;
}

/**
 * Applies `patch` only if the row is still in one of `from`. Returns the updated row,
 * or the current row if another request already moved it on.
 */
async function transition(
  admin: AdminClient,
  row: ContractRow,
  from: ContractStatus[],
  patch: Partial<ContractRow>,
): Promise<ContractRow> {
  const { data, error } = await admin
    .from("booking_contracts")
    .update(patch)
    .eq("id", row.id)
    .in("status", from)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as ContractRow | null) ?? await reload(admin, row.id);
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

const isPdf = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ContractConfig {
  appBaseUrl: string;
  webhookUrl: string;
  webhookSecretBase64: string;
  orderTtlDays: number;
  brokerEmail: string;
  /** Where a copy of the completed (signed) contract is emailed, alongside the customer. */
  completedNotifyEmail: string;
}

const DEFAULT_COMPLETED_NOTIFY_EMAIL = "dev.bahadurali@gmail.com";

function readConfig(): ContractConfig {
  const appBaseUrl = requireEnv("APP_BASE_URL").replace(/\/+$/, "");
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const webhookSecretBase64 = requireEnv("IDURA_WEBHOOK_SECRET");
  try {
    parseWebhookSecret(webhookSecretBase64);
    if (!/^https:\/\//.test(appBaseUrl) && !/^http:\/\/localhost(:\d+)?$/.test(appBaseUrl)) throw new Error("APP_BASE_URL");
  } catch {
    throw new HttpError(500, "SERVER_MISCONFIGURED", "The service is temporarily unavailable.");
  }
  const ttl = Number(Deno.env.get("IDURA_ORDER_TTL_DAYS") ?? "7");
  return {
    appBaseUrl,
    webhookUrl: Deno.env.get("IDURA_WEBHOOK_URL")?.trim() || `${supabaseUrl}/functions/v1/idura-webhook`,
    webhookSecretBase64,
    orderTtlDays: Number.isInteger(ttl) && ttl >= 1 && ttl <= 30 ? ttl : 7,
    brokerEmail: requireEnv("IDURA_BROKER_NOTIFY_EMAIL"),
    completedNotifyEmail: Deno.env.get("CONTRACT_COMPLETED_NOTIFY_EMAIL")?.trim() || DEFAULT_COMPLETED_NOTIFY_EMAIL,
  };
}

// ---------------------------------------------------------------------------
// Error mapping (user-safe messages only)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  renterName: "name",
  renterPhone: "phone number",
  renterAddress: "address",
  renterPostalCode: "postal code",
  renterCity: "city",
  make: "vehicle",
  agreedDuration: "rental period",
};

export function toHttpError(error: unknown): { http: HttpError; reason: string } {
  if (error instanceof HttpError) return { http: error, reason: error.code };
  if (error instanceof ContractDataError) {
    return {
      reason: "CONTRACT_DATA_MISSING",
      http: new HttpError(
        422,
        "CONTRACT_DATA_MISSING",
        `Some details needed for the contract are missing: ${error.missing.join(", ")}. Please go back and complete them.`,
        { missing: error.missing },
      ),
    };
  }
  if (error instanceof ContractRenderError) {
    const label = (error.field && FIELD_LABELS[error.field]) || "details";
    const message = error.code === "CONTRACT_UNSUPPORTED_CHARACTER"
      ? `Your ${label} contains characters we can't print on the contract. Please contact support.`
      : error.code === "CONTRACT_FIELD_TOO_LONG"
      ? `Your ${label} is too long to fit on the contract. Please shorten it and try again.`
      : "The contract could not be prepared. Please try again later.";
    return { reason: error.code, http: new HttpError(422, error.code, message) };
  }
  if (error instanceof IduraError) {
    const retryable = error.code === "IDURA_TIMEOUT" || error.code === "IDURA_UNAVAILABLE";
    return {
      reason: error.code,
      http: new HttpError(
        retryable ? 503 : 502,
        "SIGNING_UNAVAILABLE",
        "Digital signing is temporarily unavailable. Please try again in a moment.",
      ),
    };
  }
  return {
    reason: "INTERNAL_ERROR",
    http: new HttpError(500, "CONTRACT_FAILED", "The contract could not be prepared. Please try again."),
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Returns the booking's live contract, creating it (PDF + Idura signature order) if
 * none exists. Safe to call repeatedly: a partial unique index guarantees at most
 * one live contract per booking, so concurrent calls can't create two orders.
 */
export async function ensureContract(
  admin: AdminClient,
  idura: IduraSignaturesClient,
  booking: OwnedBooking,
  log: Logger,
): Promise<ContractRow> {
  const existing = await getActiveContract(admin, booking.id);
  if (existing) {
    const synced = await syncContract(admin, idura, existing, log);
    // An abandoned attempt that sync just marked failed may be retried below.
    if (ACTIVE_STATUSES.includes(synced.contract.status)) return synced.contract;
  }

  if (booking.status !== "pending" || !booking.client_request_id) {
    throw new HttpError(409, "BOOKING_NOT_SIGNABLE", "This booking can no longer be signed. Please start a new booking.");
  }
  if (new Date(booking.start_datetime).getTime() <= Date.now()) {
    throw new HttpError(409, "BOOKING_STARTED", "The pickup time has passed. Please choose new dates.");
  }

  // The hold may have lapsed while the customer was idle; make sure the car is still free.
  const conflicts = await findConflicts(
    admin,
    booking.car.id,
    new Date(booking.start_datetime),
    new Date(booking.end_datetime),
    booking.id,
  );
  if (conflicts.blocked || conflicts.bookings.length > 0) {
    throw new HttpError(409, "CAR_ALREADY_BOOKED", "The car is no longer available for these dates. Please select other dates.");
  }
  const { error: holdError } = await admin
    .from("bookings")
    .update({ hold_expires_at: holdUntil() })
    .eq("id", booking.id)
    .not("hold_expires_at", "is", null);
  if (holdError) throw holdError;

  const config = readConfig();
  // Itemise the authoritative (server-priced) booking total for the contract's payment
  // section: base rent, optional 25% driver surcharge, delivery and the deposit.
  const basePrice = roundCurrency(Number(booking.base_price ?? 0));
  const deliveryFee = roundCurrency(Number(booking.delivery_fee ?? 0));
  const depositAmount = roundCurrency(Number(booking.booking_deposit ?? 0));
  const totalPrice = roundCurrency(Number(booking.total_price));
  const withDriver = Boolean(booking.with_driver || booking.decoration_driver_need);
  const driverSurcharge = withDriver ? roundCurrency(basePrice * DRIVER_SURCHARGE_RATE) : 0;
  // Amount stored on the row (rent excluding the deposit), kept for continuity.
  const amount = roundCurrency(totalPrice - depositAmount);
  const issuedAt = new Date();

  // Validate the data before reserving a row so missing details don't leave failed rows behind.
  let fields: ContractFields;
  try {
    fields = buildContractFields({
      customer: booking.customer,
      car: booking.car,
      booking,
      basePrice,
      deliveryFee,
      driverSurcharge,
      depositAmount,
      totalPrice,
      issuedAt,
    });
  } catch (error) {
    throw toHttpError(error).http;
  }

  const { data: inserted, error: insertError } = await admin
    .from("booking_contracts")
    .insert({ booking_id: booking.id, customer_id: booking.customer.id, status: "generating", contract_amount: amount })
    .select("*")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const concurrent = await getActiveContract(admin, booking.id);
      if (concurrent) return concurrent;
    }
    throw insertError;
  }
  const row = inserted as ContractRow;
  log.info("contract_generating", { contractId: row.id, bookingId: booking.id });

  try {
    const pdf = await renderContractPdf(await loadContractAssets(), fields, {
      title: `Rental Agreement ${booking.booking_number}`,
    });
    const pdfSha256 = await sha256Hex(pdf);
    const unsignedPath = `unsigned/${booking.id}/${row.id}.pdf`;
    const { error: uploadError } = await admin.storage
      .from(CONTRACTS_BUCKET)
      .upload(unsignedPath, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const expiresAt = new Date(issuedAt.getTime() + config.orderTtlDays * 24 * 60 * 60 * 1000);
    const renterReturnUrl = `${config.appBaseUrl}/?contractSign=return&bookingId=${encodeURIComponent(booking.id)}`;

    // Two-party flow: the customer (renter) signs first, then the broker/admin countersigns.
    // syncContract drives the rest — on the renter's signature it emails the broker their
    // signing link (notifyBrokerOnce), and once the broker signs it closes the order, stores
    // the signed PDF and emails the completed contract to the customer and the admin.
    const order = await idura.createSignatureOrder({
      title: `Rental Agreement ${booking.booking_number}`,
      expiresAt: expiresAt.toISOString(),
      timezone: CONTRACT_TIMEZONE,
      maxSignatories: 2,
      ui: { language: "EN_US", signatoryRedirectUri: `${config.appBaseUrl}/`, enableCancel: true },
      documents: [{
        pdf: {
          title: `Rental Agreement ${booking.booking_number}`,
          blob: encodeBase64(pdf),
          storageMode: "Temporary",
          reference: row.id,
        },
      }],
      signatories: [
        {
          reference: RENTER_REFERENCE,
          signingAs: "Renter",
          signingSequence: 1,
          ui: { signatoryRedirectUri: renterReturnUrl },
        },
        {
          reference: BROKER_REFERENCE,
          signingAs: "Broker",
          signingSequence: 2,
          ui: { signatoryRedirectUri: `${config.appBaseUrl}/` },
        },
      ],
      webhook: { url: config.webhookUrl, secret: config.webhookSecretBase64, validateConnectivity: false },
    });

    const renter = order.signatories.find((s) => s.reference === RENTER_REFERENCE);
    const broker = order.signatories.find((s) => s.reference === BROKER_REFERENCE);
    const document = order.documents[0];
    if (!renter || !broker || !document) {
      throw new IduraError("IDURA_REQUEST_REJECTED", "signature order response incomplete");
    }

    const updated = await transition(admin, row, ["generating"], {
      status: "signature_pending",
      idura_signature_order_id: order.id,
      idura_document_id: document.id,
      renter_signatory_id: renter.id,
      broker_signatory_id: broker.id,
      unsigned_pdf_path: unsignedPath,
      unsigned_pdf_sha256: pdfSha256,
      expires_at: order.expiresAt ?? expiresAt.toISOString(),
    });
    log.info("contract_sent_for_signing", { contractId: row.id, signatureOrderId: order.id });
    return updated;
  } catch (error) {
    const { http, reason } = toHttpError(error);
    log.error("contract_creation_failed", { contractId: row.id, reason, ...describeError(error) });
    await admin
      .from("booking_contracts")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", row.id)
      .eq("status", "generating");
    throw http;
  }
}

// ---------------------------------------------------------------------------
// Signing link
// ---------------------------------------------------------------------------

/** Fresh signing link for the renter. Links are never stored or logged. */
export async function getRenterSigningUrl(idura: IduraSignaturesClient, row: ContractRow): Promise<string> {
  if (row.status !== "signature_pending" || !row.idura_signature_order_id) {
    throw new HttpError(409, "CONTRACT_NOT_SIGNABLE", "This contract is not awaiting your signature.");
  }
  let order: IduraSignatureOrder | null;
  try {
    order = await idura.getSignatureOrder(row.idura_signature_order_id);
  } catch (error) {
    throw toHttpError(error).http;
  }
  const renter = order?.signatories.find((s) => s.id === row.renter_signatory_id);
  if (!order || order.status !== "OPEN" || !renter || renter.status !== "OPEN") {
    throw new HttpError(409, "CONTRACT_NOT_SIGNABLE", "This contract is not awaiting your signature. Please refresh.");
  }
  const url = new URL(renter.href);
  if (url.protocol !== "https:") throw new HttpError(502, "SIGNING_UNAVAILABLE", "Digital signing is temporarily unavailable.");
  return url.toString();
}

// ---------------------------------------------------------------------------
// Reconcile with Idura
// ---------------------------------------------------------------------------

/** Side-effect dependencies, injectable for tests. */
export interface SyncDeps {
  sendMail: (message: MailMessage) => Promise<void>;
}

// Load the mailer (and its `nodemailer` dependency) only when an email is actually sent,
// keeping it out of the function's boot-time module graph.
const defaultDeps: SyncDeps = {
  sendMail: (message) => import("../mailer.ts").then((m) => m.sendMail(message)),
};

export interface SyncResult {
  contract: ContractRow;
  /** True when follow-up work (broker email, signed PDF storage) failed and should be retried. */
  retryNeeded: boolean;
}

export async function syncContract(
  admin: AdminClient,
  idura: IduraSignaturesClient,
  row: ContractRow,
  log: Logger,
  deps: SyncDeps = defaultDeps,
): Promise<SyncResult> {
  if (FINAL_STATUSES.includes(row.status)) return { contract: row, retryNeeded: false };

  if (!row.idura_signature_order_id) {
    const stale = Date.now() - new Date(row.created_at).getTime() > GENERATING_TIMEOUT_MS;
    if (row.status === "generating" && stale) {
      const failed = await transition(admin, row, ["generating"], { status: "failed", failure_reason: "GENERATION_ABANDONED" });
      return { contract: failed, retryNeeded: false };
    }
    return { contract: row, retryNeeded: false };
  }

  const order = await idura.getSignatureOrder(row.idura_signature_order_id);
  if (!order) {
    log.error("signature_order_missing", { contractId: row.id, status: row.status });
    if (row.status === "signature_pending") {
      return {
        contract: await transition(admin, row, ["signature_pending"], { status: "failed", failure_reason: "ORDER_NOT_FOUND" }),
        retryNeeded: false,
      };
    }
    return { contract: row, retryNeeded: false };
  }

  const renter = order.signatories.find((s) => s.id === row.renter_signatory_id);
  const broker = order.signatories.find((s) => s.id === row.broker_signatory_id);
  let current = row;
  let retryNeeded = false;

  if (current.status === "signature_pending") {
    if (renter?.status === "REJECTED") {
      current = await transition(admin, current, ["signature_pending"], { status: "rejected", failure_reason: "RENTER_REJECTED" });
    } else if (renter?.status === "SIGNED") {
      const signedAt = new Date().toISOString();
      current = await transition(admin, current, ["signature_pending"], { status: "renter_signed", renter_signed_at: signedAt });
      if (current.status === "renter_signed") {
        // Signing counts as progress: give the renter a fresh hold to complete payment.
        const { error } = await admin
          .from("bookings")
          .update({ contract_signed_at: current.renter_signed_at, hold_expires_at: holdUntil() })
          .eq("id", current.booking_id)
          .eq("status", "pending");
        if (error) log.error("booking_contract_flag_failed", { contractId: current.id, ...describeError(error) });
        log.info("contract_renter_signed", { contractId: current.id });
      }
    }
  }

  if (current.status === "renter_signed") {
    if (broker?.status === "REJECTED") {
      log.error("contract_broker_rejected", { contractId: current.id });
      current = await transition(admin, current, ["renter_signed"], { status: "rejected", failure_reason: "BROKER_REJECTED" });
    } else if (!broker || broker.status === "SIGNED" || order.status === "CLOSED") {
      // Single-signer flow (no broker on the order), the broker already countersigned, or
      // the order is closed: close it if needed, store the signed PDF and mark it signed.
      const finalized = await finalizeSignedContract(admin, idura, current, order, log, deps);
      current = finalized.contract;
      retryNeeded ||= finalized.retryNeeded;
    } else if (order.status === "OPEN" && broker.status === "OPEN") {
      retryNeeded ||= !(await notifyBrokerOnce(admin, current, broker, log, deps));
    }
  }

  if ((order.status === "EXPIRED" || order.status === "CANCELLED") && !FINAL_STATUSES.includes(current.status)) {
    const reason = current.status === "renter_signed" ? "BROKER_NOT_SIGNED" : `ORDER_${order.status}`;
    if (current.status === "renter_signed") log.error("contract_expired_without_broker", { contractId: current.id });
    current = await transition(admin, current, ["generating", "signature_pending", "renter_signed"], {
      status: "expired",
      failure_reason: reason,
    });
  }

  return { contract: current, retryNeeded };
}

/**
 * Emails the broker's signing link once. The claim on `broker_notified_at` prevents
 * duplicate emails from concurrent syncs; it's released again if sending fails.
 */
async function notifyBrokerOnce(
  admin: AdminClient,
  row: ContractRow,
  broker: IduraSignatory,
  log: Logger,
  deps: SyncDeps,
): Promise<boolean> {
  if (row.broker_notified_at) return true;

  const { data: claimed, error } = await admin
    .from("booking_contracts")
    .update({ broker_notified_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("broker_notified_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!claimed) return true;

  try {
    const config = readConfig();
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("booking_number, start_datetime, end_datetime, customer:customers(full_name), car:cars(brand, model)")
      .eq("id", row.booking_id)
      .single();
    if (bookingError) throw bookingError;

    const b = booking as unknown as {
      booking_number: string;
      start_datetime: string;
      end_datetime: string;
      customer: { full_name: string } | null;
      car: { brand: string; model: string } | null;
    };
    const renterName = b.customer?.full_name ?? "The renter";
    const vehicle = b.car ? `${b.car.brand} ${b.car.model}` : "";
    const period = `${formatContractDateTime(new Date(b.start_datetime))} – ${formatContractDateTime(new Date(b.end_datetime))}`;
    const expires = row.expires_at ? formatContractDateTime(new Date(row.expires_at)) : null;
    const subject = `Signature required: Rental Agreement ${b.booking_number}`;
    const lines = [
      `${renterName} has signed rental agreement ${b.booking_number}.`,
      `Vehicle: ${vehicle}`,
      `Rental period: ${period}`,
      expires ? `Please countersign as broker before ${expires}.` : "Please countersign as broker.",
    ];

    await deps.sendMail({
      to: config.brokerEmail,
      subject,
      text: `${lines.join("\n")}\n\nSign here: ${broker.href}\n\nThis link is personal to the broker. Do not forward it.`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
          ${lines.map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join("")}
          <p style="margin:20px 0">
            <a href="${escapeHtml(broker.href)}" style="background:#E3C08D;color:#111827;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
              Review and sign as broker
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280">This link is personal to the broker. Do not forward it.</p>
        </div>`,
    });
    log.info("broker_notified", { contractId: row.id });
    return true;
  } catch (sendError) {
    log.error("broker_notification_failed", { contractId: row.id, ...describeError(sendError) });
    await admin.from("booking_contracts").update({ broker_notified_at: null }).eq("id", row.id);
    return false;
  }
}

/**
 * Closes the order, stores the fully signed PDF and marks the contract signed.
 * Never overwrites a stored signed document; a hash mismatch is surfaced, not fixed.
 */
async function finalizeSignedContract(
  admin: AdminClient,
  idura: IduraSignaturesClient,
  row: ContractRow,
  order: IduraSignatureOrder,
  log: Logger,
  deps: SyncDeps = defaultDeps,
): Promise<SyncResult> {
  try {
    let documents;
    if (order.status === "OPEN") {
      try {
        documents = await idura.closeSignatureOrder(order.id);
      } catch (error) {
        // Another sync may have closed it first; fall back to the retained documents.
        if (!(error instanceof IduraError) || error.code !== "IDURA_REQUEST_REJECTED") throw error;
        documents = await idura.getSignedDocuments(order.id);
      }
    } else {
      documents = await idura.getSignedDocuments(order.id);
    }

    const document = documents.find((d) => d.id === row.idura_document_id) ?? documents[0];
    if (!document?.blob) throw new Error("SIGNED_DOCUMENT_UNAVAILABLE");
    const bytes = decodeBase64(document.blob);
    if (!isPdf(bytes)) throw new Error("SIGNED_DOCUMENT_INVALID");
    const sha256 = await sha256Hex(bytes);
    const signedPath = `signed/${row.booking_id}/${row.id}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(CONTRACTS_BUCKET)
      .upload(signedPath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      // A previous attempt may have stored it already: accept only an identical file.
      const { data: existing, error: downloadError } = await admin.storage.from(CONTRACTS_BUCKET).download(signedPath);
      if (downloadError || !existing) throw uploadError;
      const existingSha = await sha256Hex(new Uint8Array(await existing.arrayBuffer()));
      if (existingSha !== sha256) {
        log.error("signed_document_conflict", { contractId: row.id });
        throw new Error("SIGNED_DOCUMENT_CONFLICT");
      }
    }

    const now = new Date().toISOString();
    const signed = await transition(admin, row, ["renter_signed"], {
      status: "signed",
      signed_pdf_path: signedPath,
      signed_pdf_sha256: sha256,
      broker_signed_at: now,
      signed_at: now,
    });
    if (signed.status === "signed") {
      const { error } = await admin.from("bookings").update({ contract_file_path: signedPath }).eq("id", row.booking_id);
      if (error) log.error("booking_contract_path_failed", { contractId: row.id, ...describeError(error) });
      log.info("contract_fully_signed", { contractId: row.id });
      // Email the signed contract to the customer and admin (best-effort, sent once).
      await notifyContractCompletedOnce(admin, signed, bytes, log, deps);
      idura.cleanupSignatureOrder(order.id).catch((error) =>
        log.warn("signature_order_cleanup_failed", { contractId: row.id, ...describeError(error) })
      );
    }
    return { contract: signed, retryNeeded: false };
  } catch (error) {
    log.error("contract_finalize_failed", { contractId: row.id, ...describeError(error) });
    return { contract: row, retryNeeded: true };
  }
}

/**
 * Emails the signed contract PDF to the customer and the configured admin address,
 * exactly once. The claim on `completed_notified_at` prevents duplicate emails from
 * concurrent syncs; it's released again if every send fails so a later sync can retry.
 */
async function notifyContractCompletedOnce(
  admin: AdminClient,
  row: ContractRow,
  pdfBytes: Uint8Array<ArrayBuffer>,
  log: Logger,
  deps: SyncDeps,
): Promise<void> {
  if (row.completed_notified_at) return;

  const { data: claimed, error: claimError } = await admin
    .from("booking_contracts")
    .update({ completed_notified_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("completed_notified_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) {
    log.error("contract_completed_claim_failed", { contractId: row.id, ...describeError(claimError) });
    return;
  }
  if (!claimed) return; // Another sync already sent it.

  try {
    const config = readConfig();
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("booking_number, start_datetime, end_datetime, customer:customers(full_name, email), car:cars(brand, model)")
      .eq("id", row.booking_id)
      .single();
    if (bookingError) throw bookingError;

    const b = booking as unknown as {
      booking_number: string;
      start_datetime: string;
      end_datetime: string;
      customer: { full_name: string | null; email: string | null } | null;
      car: { brand: string; model: string } | null;
    };
    const customerEmail = b.customer?.email?.trim() || null;
    const customerName = b.customer?.full_name?.trim() || "there";
    const vehicle = b.car ? `${b.car.brand} ${b.car.model}` : "";
    const period = `${formatContractDateTime(new Date(b.start_datetime))} – ${formatContractDateTime(new Date(b.end_datetime))}`;
    const subject = `Your signed rental agreement – ${b.booking_number}`;
    const attachment = {
      filename: `rental-agreement-${b.booking_number}.pdf`,
      content: encodeBase64(pdfBytes),
      encoding: "base64",
      contentType: "application/pdf",
    };
    const greetingLines = [
      `Hi ${customerName},`,
      `Your rental agreement ${b.booking_number} has been signed. A copy is attached to this email.`,
    ];
    const detailLines = [
      vehicle ? `Vehicle: ${vehicle}` : null,
      `Rental period: ${period}`,
    ].filter((line): line is string => Boolean(line));
    const lines = [...greetingLines, ...detailLines];
    const message = {
      subject,
      text: `${lines.join("\n")}\n`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
          ${lines.map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join("")}
        </div>`,
      attachments: [attachment],
    };

    // The admin copy is informational; the customer is the primary recipient.
    const recipients = [customerEmail, config.completedNotifyEmail].filter((to): to is string => Boolean(to));
    let anyFailed = recipients.length === 0;
    for (const to of recipients) {
      try {
        await deps.sendMail({ to, ...message });
      } catch (sendError) {
        anyFailed = true;
        log.error("contract_completed_email_failed", { contractId: row.id, ...describeError(sendError) });
      }
    }

    if (anyFailed) {
      // Release the claim so a later status sync can try again.
      await admin.from("booking_contracts").update({ completed_notified_at: null }).eq("id", row.id);
    } else {
      log.info("contract_completed_notified", { contractId: row.id });
    }
  } catch (error) {
    log.error("contract_completed_notify_failed", { contractId: row.id, ...describeError(error) });
    await admin.from("booking_contracts").update({ completed_notified_at: null }).eq("id", row.id);
  }
}

/**
 * Emails the renter their personal signing link. Used by the admin "book on behalf"
 * flow, where the customer isn't at the desk and signs later from their own device.
 * The link is sent, never logged. Returns the address it was sent to.
 */
export async function emailRenterSignLink(
  admin: AdminClient,
  booking: OwnedBooking,
  signUrl: string,
  log: Logger,
  deps: SyncDeps = defaultDeps,
): Promise<string> {
  const { data, error } = await admin.from("customers").select("email").eq("id", booking.customer.id).single();
  if (error) throw error;
  const email = (data as { email: string | null })?.email?.trim();
  if (!email) throw new HttpError(409, "CUSTOMER_EMAIL_MISSING", "This customer has no email address on file.");

  const name = booking.customer.full_name?.trim() || "there";
  const lines = [
    `Hi ${name},`,
    `Please review and sign your rental agreement for booking ${booking.booking_number}.`,
    `Open the secure link below and sign with BankID.`,
  ];
  try {
    await deps.sendMail({
      to: email,
      subject: `Sign your rental agreement – ${booking.booking_number}`,
      text: `${lines.join("\n")}\n\nSign here: ${signUrl}\n\nThis link is personal to you. Do not forward it.`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
          ${lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join("")}
          <p style="margin:20px 0">
            <a href="${escapeHtml(signUrl)}" style="background:#E3C08D;color:#111827;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
              Review and sign
            </a>
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280">This link is personal to you. Do not forward it.</p>
        </div>`,
    });
  } catch (err) {
    log.error("renter_sign_link_email_failed", { bookingId: booking.id, ...describeError(err) });
    throw new HttpError(502, "EMAIL_FAILED", "We couldn't send the signing link. Please try again.");
  }
  log.info("renter_sign_link_emailed", { bookingId: booking.id });
  return email;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Short-lived download link for the contract PDF (signed copy when available). */
export async function createDocumentUrl(admin: AdminClient, row: ContractRow): Promise<{ url: string; signed: boolean }> {
  const path = row.signed_pdf_path ?? row.unsigned_pdf_path;
  if (!path) throw new HttpError(409, "DOCUMENT_NOT_READY", "The contract document isn't ready yet.");
  const { data, error } = await admin.storage.from(CONTRACTS_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw error ?? new Error("SIGNED_URL_FAILED");
  return { url: data.signedUrl, signed: Boolean(row.signed_pdf_path) };
}
