/**
 * Formatting for the rental agreement. All wall-clock values are rendered in the
 * business timezone (Europe/Oslo) regardless of where the code runs.
 */

export const CONTRACT_TIMEZONE = "Europe/Oslo";

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const wallClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CONTRACT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toWallClock(date: Date): WallClock {
  const parts: Record<string, number> = {};
  for (const part of wallClockFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "04.05.2026" in Oslo time. */
export function formatContractDate(date: Date): string {
  const w = toWallClock(date);
  return `${pad2(w.day)}.${pad2(w.month)}.${w.year}`;
}

/** "04.05.2026 at 12:00" in Oslo time. */
export function formatContractDateTime(date: Date): string {
  const w = toWallClock(date);
  return `${formatContractDate(date)} at ${pad2(w.hour)}:${pad2(w.minute)}`;
}

const MINUTE_MS = 60_000;

/** Wall-clock fields as a UTC timestamp, so calendar arithmetic ignores DST shifts. */
const wallClockMs = (w: WallClock) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);

const daysInMonth = (year: number, month1: number) => new Date(Date.UTC(year, month1, 0)).getUTCDate();

/** Adds whole months to a wall-clock value, clamping the day (31 Jan + 1 month = 28/29 Feb). */
function addMonths(w: WallClock, months: number): WallClock {
  const zeroBased = w.month - 1 + months;
  const year = w.year + Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return { ...w, year, month, day: Math.min(w.day, daysInMonth(year, month)) };
}

export interface CalendarDuration {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
}

/**
 * Calendar difference between two instants as seen on an Oslo wall clock.
 * A rental from 12:00 to 12:00 the next day is "1 day" even across a DST change.
 */
export function calendarDuration(start: Date, end: Date): CalendarDuration {
  const from = toWallClock(start);
  const to = toWallClock(end);
  const toMs = wallClockMs(to);

  let totalMonths = (to.year - from.year) * 12 + (to.month - from.month);
  while (totalMonths > 0 && wallClockMs(addMonths(from, totalMonths)) > toMs) totalMonths -= 1;

  const remainderMinutes = Math.max(0, Math.round((toMs - wallClockMs(addMonths(from, totalMonths))) / MINUTE_MS));

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: Math.floor(remainderMinutes / (24 * 60)),
    hours: Math.floor((remainderMinutes % (24 * 60)) / 60),
    minutes: remainderMinutes % 60,
  };
}

const unit = (n: number, singular: string) => `${n} ${singular}${n === 1 ? "" : "s"}`;

/** "1 month, 2 days and 4 hours". Zero components are omitted. */
export function formatAgreedDuration(start: Date, end: Date): string {
  const d = calendarDuration(start, end);
  const parts = [
    d.years && unit(d.years, "year"),
    d.months && unit(d.months, "month"),
    d.days && unit(d.days, "day"),
    d.hours && unit(d.hours, "hour"),
    d.minutes && unit(d.minutes, "minute"),
  ].filter((p): p is string => Boolean(p));

  if (parts.length === 0) return unit(0, "hour");
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "NOK 23,000" or "NOK 1,234.50" (decimals only when the amount has øre). */
export function formatNok(amount: number): string {
  const hasOre = Math.round(amount * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `NOK ${formatted}`;
}
