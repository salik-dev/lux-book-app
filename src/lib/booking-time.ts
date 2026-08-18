/** Minimum lead time required between "now" and a pickup date-time. */
export const MIN_PICKUP_LEAD_HOURS = 1;

export function getEarliestPickup(from: Date = new Date()): Date {
  return new Date(from.getTime() + MIN_PICKUP_LEAD_HOURS * 60 * 60 * 1000);
}

/** True when `date` is at least `MIN_PICKUP_LEAD_HOURS` ahead of `from` (defaults to now). */
export function isPickupLeadTimeValid(date: Date | null | undefined, from: Date = new Date()): boolean {
  if (!date) return false;
  return date.getTime() >= getEarliestPickup(from).getTime();
}
