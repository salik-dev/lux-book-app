/**
 * Customer-facing contract API for a booking. Works for guests: every call must carry
 * the booking's access key (see _shared/booking-access.ts).
 *
 *   { action: "status",   bookingId, accessKey } -> current contract (reconciled with Idura)
 *   { action: "create",   bookingId, accessKey } -> creates the contract if needed (idempotent)
 *   { action: "sign-url", bookingId, accessKey } -> renter's Idura signing link
 *   { action: "document", bookingId, accessKey } -> 60-second link to the contract PDF
 */

import { describeError, handlePost, HttpError, isUuid, json, readJsonBody } from "../_shared/http.ts";
import { IduraSignaturesClient } from "../_shared/idura/client.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  createDocumentUrl,
  emailRenterSignLink,
  ensureContract,
  getLatestContract,
  getRenterSigningUrl,
  loadOwnedBooking,
  syncContract,
  toHttpError,
  toPublicContract,
} from "../_shared/contract/service.ts";

const ACTIONS = ["status", "create", "sign-url", "email-sign-url", "document"] as const;
type Action = (typeof ACTIONS)[number];

function parseRequest(body: unknown): { action: Action; bookingId: string; accessKey: unknown } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!ACTIONS.includes(raw.action as Action) || !isUuid(raw.bookingId)) {
    throw new HttpError(400, "INVALID_REQUEST", "Invalid request.");
  }
  return { action: raw.action as Action, bookingId: raw.bookingId, accessKey: raw.accessKey };
}

function newIduraClient() {
  try {
    return new IduraSignaturesClient();
  } catch (error) {
    throw toHttpError(error).http;
  }
}

Deno.serve(handlePost("booking-contract", async (req, log) => {
  const admin = createAdminClient();
  const { action, bookingId, accessKey } = parseRequest(await readJsonBody(req));
  const booking = await loadOwnedBooking(admin, bookingId, accessKey);

  switch (action) {
    case "create": {
      try {
        const contract = await ensureContract(admin, newIduraClient(), booking, log);
        return json({ contract: toPublicContract(contract) });
      } catch (error) {
        if (!(error instanceof HttpError)) log.error("contract_create_failed", describeError(error));
        throw toHttpError(error).http;
      }
    }

    case "status": {
      const latest = await getLatestContract(admin, booking.id);
      if (!latest) return json({ contract: null });
      try {
        const { contract } = await syncContract(admin, newIduraClient(), latest, log);
        return json({ contract: toPublicContract(contract) });
      } catch (error) {
        // Idura being briefly unreachable shouldn't hide the last known state.
        log.warn("contract_sync_skipped", { contractId: latest.id, ...describeError(error) });
        return json({ contract: toPublicContract(latest), stale: true });
      }
    }

    case "sign-url": {
      const latest = await getLatestContract(admin, booking.id);
      if (!latest) throw new HttpError(409, "CONTRACT_NOT_FOUND", "Please prepare the contract first.");
      const url = await getRenterSigningUrl(newIduraClient(), latest);
      return json({ url });
    }

    case "email-sign-url": {
      const latest = await getLatestContract(admin, booking.id);
      if (!latest) throw new HttpError(409, "CONTRACT_NOT_FOUND", "Please prepare the contract first.");
      try {
        const url = await getRenterSigningUrl(newIduraClient(), latest);
        const sentTo = await emailRenterSignLink(admin, booking, url, log);
        return json({ ok: true, sentTo });
      } catch (error) {
        if (!(error instanceof HttpError)) log.error("email_sign_url_failed", describeError(error));
        throw toHttpError(error).http;
      }
    }

    case "document": {
      const latest = await getLatestContract(admin, booking.id);
      if (!latest) throw new HttpError(409, "CONTRACT_NOT_FOUND", "Please prepare the contract first.");
      return json(await createDocumentUrl(admin, latest));
    }
  }
}));
