/**
 * Europe/Oslo wall-clock helpers.
 *
 * The whole app treats a rental's pickup/return as **Oslo local time** (the rental
 * location), so the time a customer picks is Oslo time and is shown identically
 * everywhere — booking form, summary, review, contract, admin, invoice and email.
 *
 * The date pickers work in "naive" wall-clock (plain Date objects whose local fields are
 * the numbers the user sees). Those numbers are interpreted as Oslo only when an exact
 * instant is needed (pricing, availability, persistence) via {@link naiveToOsloInstant},
 * and converted back for the picker via {@link osloInstantToNaive}. Everything stored and
 * sent to the server is a real UTC instant; only the *display zone* is fixed to Oslo.
 */

export const RENTAL_TIMEZONE = "Europe/Oslo";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: RENTAL_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface OsloParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The Oslo wall-clock fields of an instant. */
export function osloParts(date: Date): OsloParts {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Oslo's offset ahead of UTC (ms) at a given instant. */
function osloOffsetMs(utcMs: number): number {
  const p = osloParts(new Date(utcMs));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant whose Oslo wall-clock equals the given fields (DST-safe). */
export function osloWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = osloOffsetMs(guess);
  let instant = guess - firstOffset;
  // Re-check once in case the guess landed on the other side of a DST transition.
  const secondOffset = osloOffsetMs(instant);
  if (secondOffset !== firstOffset) instant = guess - secondOffset;
  return new Date(instant);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** A plain local Date whose local fields mirror `date`'s Oslo wall-clock (for the pickers). */
export function osloInstantToNaive(date: Date): Date {
  const p = osloParts(date);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
}

/** Interprets a naive picker Date's local fields as Oslo wall-clock and returns the instant. */
export function naiveToOsloInstant(naive: Date): Date {
  return osloWallClockToDate(
    naive.getFullYear(),
    naive.getMonth() + 1,
    naive.getDate(),
    naive.getHours(),
    naive.getMinutes(),
  );
}

/** `Date` → `"2026-10-16T20:22"` (Oslo), for `<input type="datetime-local">` values. */
export function toOsloInputValue(date: Date): string {
  const p = osloParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** `"2026-10-16T20:22"` (Oslo wall-clock) → instant, or null when unparseable. */
export function parseOsloInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return osloWallClockToDate(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

/** Formats an instant in Oslo with the given Intl options. */
export function formatOslo(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: RENTAL_TIMEZONE, ...options }).format(date);
}

/** `"October 16, 2026, 8:22 PM"` — long date + time, in Oslo. */
export function formatOsloLong(date: Date): string {
  return formatOslo(date, { dateStyle: "long", timeStyle: "short" });
}

/** `"2026-10-16 20:22"` — compact, in Oslo. */
export function formatOsloCompact(date: Date): string {
  const p = osloParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}
