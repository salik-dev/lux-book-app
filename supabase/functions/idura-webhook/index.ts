/**
 * Idura Signatures webhook receiver (public; deployed with verify_jwt = false).
 *
 * Security: every request must carry a valid X-Criipto-Signature HMAC of the raw
 * body; anything else is rejected before parsing. The payload is only used to find
 * the contract — the actual state is read back from the Idura API by syncContract,
 * so a forged or replayed event can't mark a contract as signed.
 *
 * Idempotency: deliveries are deduplicated by body hash, and state transitions are
 * conditional. Non-2xx responses make Idura retry (up to 10 times over ~48h), which
 * is used deliberately when follow-up work such as storing the signed PDF fails.
 */

import { createLogger, describeError, json } from "../_shared/http.ts";
import { IduraSignaturesClient } from "../_shared/idura/client.ts";
import {
  parseWebhookEvent,
  parseWebhookSecret,
  STATE_CHANGING_EVENTS,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "../_shared/idura/webhook.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { type ContractRow, syncContract } from "../_shared/contract/service.ts";

const log = createLogger("idura-webhook");
const MAX_BODY_BYTES = 16 * 1024;

const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let secret: Uint8Array<ArrayBuffer>;
  try {
    secret = parseWebhookSecret(Deno.env.get("IDURA_WEBHOOK_SECRET"));
  } catch (error) {
    log.error("webhook_secret_misconfigured", describeError(error));
    return json({ error: "unavailable" }, 503);
  }

  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 400);

  if (!(await verifyWebhookSignature(secret, body, req.headers.get(WEBHOOK_SIGNATURE_HEADER)))) {
    log.warn("webhook_signature_invalid");
    return json({ error: "invalid_signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const event = parseWebhookEvent(payload);
  if (!event) {
    log.warn("webhook_event_unrecognised");
    return json({ ok: true }); // Acknowledge so unknown future events aren't retried forever.
  }
  if (event.event === "WEBHOOK_VALIDATION") return json({ ok: true });

  const admin = createAdminClient();
  const bodyHash = await sha256Hex(body);

  try {
    const { data: logged, error: logError } = await admin
      .from("idura_webhook_events")
      .upsert(
        { body_sha256: bodyHash, event: event.event, signature_order_id: event.signatureOrderId, signatory_id: event.signatoryId },
        { onConflict: "body_sha256", ignoreDuplicates: false },
      )
      .select("id, processed_at")
      .single();
    if (logError) throw logError;
    if (logged.processed_at) return json({ ok: true, duplicate: true });

    if (STATE_CHANGING_EVENTS.has(event.event)) {
      const { data: contract, error } = await admin
        .from("booking_contracts")
        .select("*")
        .eq("idura_signature_order_id", event.signatureOrderId)
        .maybeSingle();
      if (error) throw error;

      if (!contract) {
        // Order created by another system/application, or our row isn't committed yet.
        log.warn("webhook_contract_not_found", { event: event.event });
        return json({ error: "unknown_order" }, 404);
      }

      const result = await syncContract(admin, new IduraSignaturesClient(), contract as ContractRow, log);
      log.info("webhook_processed", { event: event.event, contractId: contract.id, status: result.contract.status });
      if (result.retryNeeded) return json({ error: "retry" }, 500);
    }

    await admin.from("idura_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", logged.id);
    return json({ ok: true });
  } catch (error) {
    log.error("webhook_processing_failed", { event: event.event, ...describeError(error) });
    return json({ error: "retry" }, 500);
  }
});
