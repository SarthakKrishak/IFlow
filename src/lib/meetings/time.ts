/**
 * Meetings — wall-clock / time-zone helpers (no dependencies).
 *
 * The organizer types a wall-clock time ("10:00") in a chosen IANA zone. That pair
 * is the source of truth and is sent to Google verbatim (`dateTime` + `timeZone`), so
 * recurring meetings keep their local time across DST changes. A derived UTC instant is
 * stored only for ordering/"is it in the past" checks.
 *
 * "Local" strings are always `YYYY-MM-DDTHH:mm` (no zone, no seconds).
 */

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface LocalParts {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  mi: number;
}

export function parseLocal(local: string): LocalParts {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error(`Invalid local date-time: ${local}`);
  return { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

export function isLocalDateTime(value: string): boolean {
  const m = LOCAL_RE.exec(value);
  if (!m) return false;
  const { y, m: mo, d, h, mi } = { y: +m[1], m: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function toLocal(p: LocalParts): string {
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for the calendar date of a local string. */
export function weekdayOf(local: string): number {
  const { y, m, d } = parseLocal(local);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Calendar-day arithmetic on a local string (time of day is preserved). */
export function addDays(local: string, days: number): string {
  const p = parseLocal(local);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return toLocal({ ...p, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function dateOnly(local: string): string {
  return local.slice(0, 10);
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `tz` from UTC at a UTC instant: positive east of Greenwich. */
function offsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") get[part.type] = parseInt(part.value, 10);
  }
  const asUtc = Date.UTC(get.year, get.month - 1, get.day, get.hour, get.minute, get.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` → the UTC instant (handles DST; a nonexistent time moves forward). */
export function zonedToUtc(local: string, tz: string): Date {
  const p = parseLocal(local);
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, 0);
  let utc = wall - offsetMs(wall, tz);
  const second = offsetMs(utc, tz);
  utc = wall - second; // re-check across a DST boundary
  return new Date(utc);
}

/** UTC instant → wall-clock time in `tz` as a local string. */
export function utcToZoned(date: Date, tz: string): string {
  const ms = date.getTime() + offsetMs(date.getTime(), tz);
  const t = new Date(ms);
  return toLocal({
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
  });
}

/** End of a meeting: start + duration measured in real elapsed minutes. */
export function endLocal(startLocal: string, tz: string, durationMin: number): string {
  const start = zonedToUtc(startLocal, tz);
  return utcToZoned(new Date(start.getTime() + durationMin * 60_000), tz);
}

/** RFC 5545 UTC date-time, e.g. 20261231T183000Z */
export function toRfcUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function formatInZone(
  date: Date,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  locale = "en-US"
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }).format(date);
}

/** Short zone label such as "IST" or "GMT+5:30". */
export function zoneAbbr(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

const FALLBACK_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

export function listTimeZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    const zones = supported ? supported("timeZone") : FALLBACK_ZONES;
    return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    return FALLBACK_ZONES;
  }
}
