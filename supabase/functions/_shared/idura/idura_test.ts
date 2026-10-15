import { assert, assertEquals, assertFalse, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { IduraError, IduraSignaturesClient } from "./client.ts";
import {
  computeWebhookSignature,
  decodeBase64,
  encodeBase64,
  parseWebhookEvent,
  parseWebhookSecret,
  verifyWebhookSignature,
} from "./webhook.ts";

const SECRET_B64 = encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
const body = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

Deno.test("webhook: accepts a correctly signed body", async () => {
  const secret = parseWebhookSecret(SECRET_B64);
  const payload = body({ event: "SIGNATORY_SIGNED", signatureOrderId: "so_1", signatoryId: "s_1" });
  const header = encodeBase64(await computeWebhookSignature(secret, payload));
  assert(await verifyWebhookSignature(secret, payload, header));
});

Deno.test("webhook: rejects missing, malformed, wrong-key and tampered signatures", async () => {
  const secret = parseWebhookSecret(SECRET_B64);
  const otherSecret = parseWebhookSecret(encodeBase64(crypto.getRandomValues(new Uint8Array(32))));
  const payload = body({ event: "SIGNATORY_SIGNED", signatureOrderId: "so_1" });
  const valid = encodeBase64(await computeWebhookSignature(secret, payload));

  assertFalse(await verifyWebhookSignature(secret, payload, null));
  assertFalse(await verifyWebhookSignature(secret, payload, "not base64!!"));
  assertFalse(await verifyWebhookSignature(otherSecret, payload, valid));
  const tampered = body({ event: "SIGNATORY_SIGNED", signatureOrderId: "so_2" });
  assertFalse(await verifyWebhookSignature(secret, tampered, valid));
});

Deno.test("webhook: secret must be 256-512 bits of base64", () => {
  assertThrows(() => parseWebhookSecret(undefined));
  assertThrows(() => parseWebhookSecret(encodeBase64(new Uint8Array(16))));
  assertThrows(() => parseWebhookSecret(encodeBase64(new Uint8Array(65))));
  assertEquals(parseWebhookSecret(encodeBase64(new Uint8Array(64))).length, 64);
});

Deno.test("webhook: event parsing validates shape", () => {
  assertEquals(parseWebhookEvent({ event: "SIGNATORY_SIGNED", signatureOrderId: "so_1", signatoryId: "s_1" }), {
    event: "SIGNATORY_SIGNED",
    signatureOrderId: "so_1",
    signatoryId: "s_1",
  });
  assertEquals(parseWebhookEvent({ event: "WEBHOOK_VALIDATION" })?.event, "WEBHOOK_VALIDATION");
  assertEquals(parseWebhookEvent({ event: "SIGNATORY_SIGNED" }), null); // missing order id
  assertEquals(parseWebhookEvent({ event: "SOMETHING_ELSE", signatureOrderId: "so_1" }), null);
  assertEquals(parseWebhookEvent({ event: "SIGNATORY_SIGNED", signatureOrderId: "<script>" }), null);
  assertEquals(parseWebhookEvent("nope"), null);
});

Deno.test("base64 round trip", () => {
  // Larger than the encoder's 32 KiB chunk size, like a real PDF.
  const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31 + 7) % 256);
  assertEquals(decodeBase64(encodeBase64(bytes)), bytes);
});

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function withCredentials<T>(fn: () => Promise<T>): Promise<T> {
  Deno.env.set("IDURA_SIGNATURES_CLIENT_ID", "urn:my:application:identifier:1");
  Deno.env.set("IDURA_SIGNATURES_CLIENT_SECRET", "s3cr3t");
  return fn().finally(() => {
    Deno.env.delete("IDURA_SIGNATURES_CLIENT_ID");
    Deno.env.delete("IDURA_SIGNATURES_CLIENT_SECRET");
  });
}

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

Deno.test("client: refuses to start without credentials", () => {
  Deno.env.delete("IDURA_SIGNATURES_CLIENT_ID");
  const err = assertThrows(() => new IduraSignaturesClient(), IduraError);
  assertEquals(err.code, "IDURA_NOT_CONFIGURED");
});

Deno.test("client: sends Basic auth to the Idura endpoint", () =>
  withCredentials(async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const client = new IduraSignaturesClient((input, init) => {
      seen = { url: String(input), auth: new Headers(init?.headers).get("Authorization") };
      return Promise.resolve(jsonResponse({ data: { signatureOrder: null } }));
    });
    assertEquals(await client.getSignatureOrder("so_1"), null);
    assertEquals(seen!.url, "https://signatures.idura.app/v1/graphql");
    assertEquals(seen!.auth, `Basic ${btoa("urn:my:application:identifier:1:s3cr3t")}`);
  }));

Deno.test("client: retries reads on 5xx but never retries mutations", () =>
  withCredentials(async () => {
    let calls = 0;
    const failing = new IduraSignaturesClient(() => {
      calls++;
      return Promise.resolve(new Response("busy", { status: 503 }));
    });

    await assertRejects(() => failing.getSignatureOrder("so_1"), IduraError, "IDURA_UNAVAILABLE");
    assertEquals(calls, 3);

    calls = 0;
    await assertRejects(() => failing.closeSignatureOrder("so_1"), IduraError);
    assertEquals(calls, 1);
  }));

Deno.test("client: maps auth failures and GraphQL errors without leaking secrets", () =>
  withCredentials(async () => {
    const unauthorized = new IduraSignaturesClient(() => Promise.resolve(new Response("", { status: 401 })));
    const authErr = await assertRejects(() => unauthorized.getSignatureOrder("so_1"), IduraError);
    assertEquals(authErr.code, "IDURA_AUTH_FAILED");

    const rejected = new IduraSignaturesClient(() =>
      Promise.resolve(jsonResponse({ errors: [{ message: "Signature order not open", extensions: { code: "BAD_USER_INPUT" } }] }))
    );
    const err = await assertRejects(() => rejected.closeSignatureOrder("so_1"), IduraError);
    assertEquals(err.code, "IDURA_REQUEST_REJECTED");
    assertEquals(err.message, "IDURA_REQUEST_REJECTED");
    assertFalse(String(err.logDetail).includes("s3cr3t"));
  }));

Deno.test("client: network timeouts surface as IDURA_TIMEOUT", () =>
  withCredentials(async () => {
    const client = new IduraSignaturesClient(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    const err = await assertRejects(() => client.createSignatureOrder({} as never), IduraError);
    assertEquals(err.code, "IDURA_TIMEOUT");
  }));
