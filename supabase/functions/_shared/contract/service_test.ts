import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { createLogger } from "../http.ts";
import { IduraError, type IduraSignatureOrder, type IduraSignaturesClient, type SignatoryStatus } from "../idura/client.ts";
import { encodeBase64 } from "../idura/webhook.ts";
import type { MailMessage } from "../mailer.ts";
import type { AdminClient } from "../supabase.ts";
import { FakeSupabase } from "../testing/fake-supabase.ts";
import { type ContractRow, emailRenterSignLink, type OwnedBooking, syncContract, toPublicContract } from "./service.ts";

Deno.env.set("APP_BASE_URL", "https://app.example.no");
Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
Deno.env.set("IDURA_WEBHOOK_SECRET", encodeBase64(new Uint8Array(32).fill(7)));
Deno.env.set("IDURA_BROKER_NOTIFY_EMAIL", "broker@example.no");

const log = createLogger("test");
const SIGNED_PDF = new TextEncoder().encode("%PDF-1.7 signed contract");
const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

class FakeIdura {
  order: IduraSignatureOrder = {
    id: "so_1",
    status: "OPEN",
    expiresAt: null,
    closedAt: null,
    documents: [{ id: "doc_1", reference: null }],
    signatories: [
      { id: "sig_renter", reference: "renter", status: "OPEN", href: "https://signatures.idura.app/sign/renter" },
      { id: "sig_broker", reference: "broker", status: "OPEN", href: "https://signatures.idura.app/sign/broker" },
    ],
  };
  closeCalls = 0;
  closeError: IduraError | null = null;
  blob = encodeBase64(SIGNED_PDF);

  set(reference: "renter" | "broker", status: SignatoryStatus) {
    this.order.signatories.find((s) => s.reference === reference)!.status = status;
  }
  getSignatureOrder() {
    return Promise.resolve(structuredClone(this.order));
  }
  closeSignatureOrder() {
    this.closeCalls++;
    if (this.closeError) return Promise.reject(this.closeError);
    this.order.status = "CLOSED";
    return Promise.resolve([{ id: "doc_1", blob: this.blob }]);
  }
  getSignedDocuments() {
    return Promise.resolve([{ id: "doc_1", blob: this.blob }]);
  }
  cleanupSignatureOrder() {
    return Promise.resolve();
  }
}

function setup(status: ContractRow["status"] = "signature_pending") {
  const db = new FakeSupabase();
  db.table("bookings").push({
    id: BOOKING_ID,
    status: "pending",
    booking_number: "FJB1",
    start_datetime: "2026-11-01T10:00:00Z",
    end_datetime: "2026-11-03T10:00:00Z",
    hold_expires_at: new Date(Date.now() + 60_000).toISOString(),
    contract_signed_at: null,
    contract_file_path: null,
  });
  db.joins.set("bookings", (row) => ({ ...row, customer: { full_name: "Kari Nordmann", email: "kari@example.no" }, car: { brand: "Tesla", model: "Model 3" } }));
  const contract: ContractRow = {
    id: "c_1",
    booking_id: BOOKING_ID,
    customer_id: "cust_1",
    status,
    idura_signature_order_id: "so_1",
    idura_document_id: "doc_1",
    renter_signatory_id: "sig_renter",
    broker_signatory_id: "sig_broker",
    contract_amount: 15000,
    unsigned_pdf_path: `unsigned/${BOOKING_ID}/c_1.pdf`,
    unsigned_pdf_sha256: "abc",
    signed_pdf_path: null,
    signed_pdf_sha256: null,
    renter_signed_at: null,
    broker_signed_at: null,
    signed_at: null,
    broker_notified_at: null,
    completed_notified_at: null,
    expires_at: "2026-10-15T10:00:00Z",
    failure_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.table("booking_contracts").push(contract as unknown as Record<string, unknown>);

  const idura = new FakeIdura();
  const mails: MailMessage[] = [];
  const deps = { sendMail: (m: MailMessage) => (mails.push(m), Promise.resolve()) };
  const current = () => db.table("booking_contracts")[0] as unknown as ContractRow;
  const sync = (overrideDeps = deps) =>
    syncContract(db as unknown as AdminClient, idura as unknown as IduraSignaturesClient, current(), log, overrideDeps);
  return { db, idura, mails, current, sync };
}

Deno.test("renter signature unlocks payment and emails the broker exactly once", async () => {
  const { db, idura, mails, current, sync } = setup();
  idura.set("renter", "SIGNED");

  const first = await sync();
  assertEquals(first.contract.status, "renter_signed");
  assertFalse(first.retryNeeded);
  assert(toPublicContract(current()).canPay);
  assert(db.table("bookings")[0].contract_signed_at);

  // Duplicate webhook deliveries / concurrent status polls.
  await sync();
  await sync();
  assertEquals(mails.length, 1);
  assertEquals(mails[0].to, "broker@example.no");
  assert(mails[0].text.includes("https://signatures.idura.app/sign/broker"));
  assertFalse(mails[0].text.includes("sign/renter"));
});

Deno.test("failed broker email is released and retried", async () => {
  const { mails, current, idura, sync } = setup();
  idura.set("renter", "SIGNED");

  const failing = await sync({ sendMail: () => Promise.reject(new Error("smtp down")) });
  assertEquals(failing.contract.status, "renter_signed");
  assert(failing.retryNeeded);
  assertEquals(current().broker_notified_at, null);

  const retried = await sync();
  assertFalse(retried.retryNeeded);
  assertEquals(mails.length, 1);
  assert(current().broker_notified_at);
});

Deno.test("broker signature closes the order and stores the signed PDF once", async () => {
  const { db, idura, current, sync } = setup();
  idura.set("renter", "SIGNED");
  await sync();
  idura.set("broker", "SIGNED");

  const result = await sync();
  assertEquals(result.contract.status, "signed");
  assertEquals(idura.closeCalls, 1);
  const path = `signed/${BOOKING_ID}/c_1.pdf`;
  assertEquals(current().signed_pdf_path, path);
  assertEquals(db.files.get(`contracts/${path}`), SIGNED_PDF);
  assertEquals(db.table("bookings")[0].contract_file_path, path);

  // Final state: later events are no-ops and never touch Idura again.
  await sync();
  assertEquals(idura.closeCalls, 1);
});

Deno.test("single-signer: customer signature finalizes and emails the signed contract once", async () => {
  const { db, idura, mails, current, sync } = setup();
  // No broker on the order: the customer's signature completes the agreement.
  idura.order.signatories = idura.order.signatories.filter((s) => s.reference === "renter");
  Object.assign(db.table("booking_contracts")[0], { broker_signatory_id: null });
  idura.set("renter", "SIGNED");

  const result = await sync();
  assertEquals(result.contract.status, "signed");
  assertEquals(idura.closeCalls, 1);
  const path = `signed/${BOOKING_ID}/c_1.pdf`;
  assertEquals(current().signed_pdf_path, path);
  assertEquals(db.table("bookings")[0].contract_file_path, path);

  const completed = mails.filter((m) => m.subject.startsWith("Your signed rental agreement"));
  assertEquals(completed.length, 2);
  assert(completed.every((m) => m.attachments?.length === 1 && m.attachments[0].encoding === "base64"));
  assert(completed.some((m) => m.to === "kari@example.no"));
  assert(completed.some((m) => m.to === "dev.bahadurali@gmail.com"));

  // Duplicate webhook deliveries / status polls never resend.
  await sync();
  assertEquals(mails.filter((m) => m.subject.startsWith("Your signed rental agreement")).length, 2);
});

Deno.test("both signatures arriving before the first sync go straight to signed", async () => {
  const { idura, sync } = setup();
  idura.set("renter", "SIGNED");
  idura.set("broker", "SIGNED");
  const result = await sync();
  assertEquals(result.contract.status, "signed");
});

Deno.test("an order already closed by a concurrent sync is finalized from retained documents", async () => {
  const { idura, sync } = setup("renter_signed");
  idura.set("broker", "SIGNED");
  idura.closeError = new IduraError("IDURA_REQUEST_REJECTED", "already closed");
  const result = await sync();
  assertEquals(result.contract.status, "signed");
});

Deno.test("a stored signed document is never replaced by different content", async () => {
  const { db, idura, current, sync } = setup("renter_signed");
  const path = `contracts/signed/${BOOKING_ID}/c_1.pdf`;
  const original = new TextEncoder().encode("%PDF-1.7 original");
  db.files.set(path, original);
  idura.set("broker", "SIGNED");

  const result = await sync();
  assert(result.retryNeeded);
  assertEquals(current().status, "renter_signed");
  assertEquals(db.files.get(path), original);
});

Deno.test("a non-PDF signed blob is rejected", async () => {
  const { idura, current, sync } = setup("renter_signed");
  idura.set("broker", "SIGNED");
  idura.blob = encodeBase64(new TextEncoder().encode("<html>error</html>"));
  const result = await sync();
  assert(result.retryNeeded);
  assertEquals(current().status, "renter_signed");
});

Deno.test("renter rejection and order expiry are terminal and block payment", async () => {
  const rejected = setup();
  rejected.idura.set("renter", "REJECTED");
  assertEquals((await rejected.sync()).contract.status, "rejected");
  assertFalse(toPublicContract(rejected.current()).canPay);

  const expired = setup();
  expired.idura.order.status = "EXPIRED";
  const result = await expired.sync();
  assertEquals(result.contract.status, "expired");
  assertEquals(result.contract.failure_reason, "ORDER_EXPIRED");

  // A later "signed" event can't resurrect it.
  expired.idura.set("renter", "SIGNED");
  assertEquals((await expired.sync()).contract.status, "expired");
});

Deno.test("broker never signing before expiry is flagged", async () => {
  const { idura, sync } = setup("renter_signed");
  idura.order.status = "EXPIRED";
  const result = await sync();
  assertEquals(result.contract.status, "expired");
  assertEquals(result.contract.failure_reason, "BROKER_NOT_SIGNED");
});

Deno.test("an abandoned generating row is failed so a new attempt can start", async () => {
  const { db, sync } = setup("generating");
  Object.assign(db.table("booking_contracts")[0], {
    idura_signature_order_id: null,
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });
  const result = await sync();
  assertEquals(result.contract.status, "failed");
  assertEquals(result.contract.failure_reason, "GENERATION_ABANDONED");
});

Deno.test("emailRenterSignLink emails the customer their personal signing link", async () => {
  const db = new FakeSupabase();
  db.table("customers").push({ id: "cust_1", email: "kari@example.no", full_name: "Kari Nordmann" });
  const booking = {
    id: BOOKING_ID,
    booking_number: "FJB1",
    status: "pending",
    start_datetime: "2026-11-01T10:00:00Z",
    end_datetime: "2026-11-03T10:00:00Z",
    total_price: 1,
    booking_deposit: 0,
    client_request_id: "req_1",
    customer: { id: "cust_1", user_id: null, full_name: "Kari Nordmann", phone: "", address: "", postal_code: "", city: "" },
    car: { id: "car_1", brand: "Tesla", model: "Model 3", name: "Tesla Model 3" },
  } as unknown as OwnedBooking;

  const mails: MailMessage[] = [];
  const sentTo = await emailRenterSignLink(
    db as unknown as AdminClient,
    booking,
    "https://signatures.idura.app/sign/renter-abc",
    log,
    { sendMail: (m: MailMessage) => (mails.push(m), Promise.resolve()) },
  );

  assertEquals(sentTo, "kari@example.no");
  assertEquals(mails.length, 1);
  assertEquals(mails[0].to, "kari@example.no");
  assert(mails[0].subject.includes("FJB1"));
  assert(mails[0].text.includes("https://signatures.idura.app/sign/renter-abc"));
});

Deno.test("public view never exposes signing links or storage paths", () => {
  const { current } = setup("signed");
  const view = toPublicContract({ ...current(), signed_pdf_path: "signed/x.pdf" });
  const serialized = JSON.stringify(view);
  assertFalse(serialized.includes("signed/x.pdf"));
  assertFalse(serialized.includes("sig_"));
  assertFalse(serialized.includes("so_1"));
  assert(view.hasSignedDocument);
});
