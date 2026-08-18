import { supabase } from "@/integrations/supabase/client";

/**
 * Re-enables cars whose unavailability block(s) have all naturally expired.
 * A car stays disabled if it has at least one block with `end_datetime` still
 * in the future (covers both ongoing and not-yet-started blocks) — matching
 * the existing behavior where creating a block immediately disables the car.
 * Cars with no block history at all (manually disabled) are never touched.
 */
export async function sweepExpiredCarUnavailability(): Promise<void> {
  const nowIso = new Date().toISOString();

  const { data: blocks, error } = await supabase
    .from("car_unavailability")
    .select("car_id, end_datetime");

  if (error || !blocks || blocks.length === 0) return;

  const stillBlockedCarIds = new Set<string>();
  const expiredCarIds = new Set<string>();
  for (const b of blocks as { car_id: string; end_datetime: string }[]) {
    if (b.end_datetime >= nowIso) stillBlockedCarIds.add(b.car_id);
    else expiredCarIds.add(b.car_id);
  }

  const carIdsToReEnable = [...expiredCarIds].filter((id) => !stillBlockedCarIds.has(id));
  if (carIdsToReEnable.length === 0) return;

  const { data: disabledCars, error: disabledError } = await supabase
    .from("cars")
    .select("id")
    .in("id", carIdsToReEnable)
    .eq("is_available", false);

  if (disabledError || !disabledCars || disabledCars.length === 0) return;

  const idsToUpdate = disabledCars.map((c) => c.id);
  const { error: updateError } = await supabase
    .from("cars")
    .update({ is_available: true })
    .in("id", idsToUpdate);

  if (updateError) {
    console.error("Failed to re-enable cars with expired unavailability blocks:", updateError);
  }
}
