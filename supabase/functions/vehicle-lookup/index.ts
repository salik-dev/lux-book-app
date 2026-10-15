/**
 * Admin-only Statens vegvesen vehicle register lookup for fleet management.
 *
 *   { mode: "verify", registrationNumber, carId? } -> { vehicle, warnings }
 *       Add/Edit Vehicle form. Rejects plates already used by another fleet car
 *       (carId = the car being edited, which may keep its own plate).
 *   { mode: "preview", registrationNumber }        -> { details }
 *       Fleet preview drawer: full register data, also for deregistered vehicles.
 *
 * Secrets (read in _shared/vegvesen/vehicle.ts): VITE_VEGVESEN_VEHICLE_VERIFICATION_KEY
 * (required, stays server-side) and VITE_VEGVESEN_VEHICLE_VERIFICATION_URL (optional).
 */

import { describeError, handlePost, HttpError, isUuid, json, type Logger, readJsonBody } from "../_shared/http.ts";
import { type AdminClient, createAdminClient, requireAdmin } from "../_shared/supabase.ts";
import {
  formatPlate,
  isRegistrationNumber,
  lookupVehicle,
  normalizeRegistrationNumber,
  previewVehicle,
} from "../_shared/vegvesen/vehicle.ts";

type Mode = "verify" | "preview";

function parseRequest(body: unknown): { mode: Mode; registrationNumber: string; carId: string | null } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const mode = raw.mode ?? "verify";
  if (mode !== "verify" && mode !== "preview") throw new HttpError(400, "INVALID_REQUEST", "Invalid request.");

  const registrationNumber = normalizeRegistrationNumber(raw.registrationNumber);
  if (!isRegistrationNumber(registrationNumber)) {
    throw new HttpError(400, "INVALID_REGISTRATION_NUMBER", "Enter a valid registration number, e.g. EN 10257.");
  }

  if (raw.carId != null && !isUuid(raw.carId)) throw new HttpError(400, "INVALID_REQUEST", "Invalid request.");
  return { mode, registrationNumber, carId: (raw.carId as string | undefined) ?? null };
}

/** Fails with 409 if another fleet car already uses this plate. Checked before calling Vegvesen. */
async function assertNotInFleet(admin: AdminClient, registrationNumber: string, carId: string | null, log: Logger) {
  const { data, error } = await admin
    .from("cars")
    .select("id, name")
    .eq("registration_number", registrationNumber)
    .maybeSingle();

  if (error) {
    log.error("fleet_duplicate_check_failed", describeError(error));
    throw new HttpError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
  if (data && data.id !== carId) {
    throw new HttpError(
      409,
      "VEHICLE_ALREADY_IN_FLEET",
      `${formatPlate(registrationNumber)} is already in your fleet as “${data.name}”. Each vehicle can only be added once.`,
    );
  }
}

Deno.serve(handlePost("vehicle-lookup", async (req, log) => {
  const admin = createAdminClient();
  await requireAdmin(req, admin);

  const { mode, registrationNumber, carId } = parseRequest(await readJsonBody(req));

  if (mode === "preview") {
    const details = await previewVehicle(registrationNumber, log);
    return json({ details });
  }

  await assertNotInFleet(admin, registrationNumber, carId, log);
  const result = await lookupVehicle(registrationNumber, log);
  log.info("vehicle_found", { warnings: result.warnings.length });
  return json(result);
}));
