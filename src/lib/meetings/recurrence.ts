/**
 * Meetings — recurrence rules.
 *
 * Structured rule (what the UI edits and the DB stores) → RFC 5545 RRULE for Google,
 * a human description, and an occurrence generator used for the agenda and the
 * "next dates" preview. Generation is done on wall-clock (local) dates, which is
 * exactly how Google expands a rule with a TZID: the local time never shifts across DST.
 */

import { addDays, daysInMonth, dateOnly, isLocalDateTime, parseLocal, toLocal, toRfcUtc, weekdayOf, zonedToUtc } from "./time";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type MonthlyMode = "DAY_OF_MONTH" | "NTH_WEEKDAY";
export type EndType = "NEVER" | "ON_DATE" | "AFTER_COUNT";

export interface RecurrenceRule {
  freq: Freq;
  interval: number;
  byWeekday: Weekday[];
  monthlyMode?: MonthlyMode | null;
  endType: EndType;
  /** YYYY-MM-DD, inclusive, in the meeting's time zone. */
  untilDate?: string | null;
  count?: number | null;
}

/** Monday-first, matching WKST=MO below. */
export const WEEKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};
const WEEKDAY_LONG: Record<Weekday, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};
// JS getUTCDay(): 0=Sun … 6=Sat
const JS_TO_CODE: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const MAX_INTERVAL = 52;
export const MAX_COUNT = 730;

export function weekdayCode(local: string): Weekday {
  return JS_TO_CODE[weekdayOf(local)];
}

const WEEKDAYS_ONLY: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];
const sameSet = (a: Weekday[], b: Weekday[]) => a.length === b.length && a.every((x) => b.includes(x));
const sortWeekdays = (days: Weekday[]) => [...new Set(days)].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));

/** nth occurrence (1-4, or -1 for "last") of the start date's weekday within its month. */
export function nthWeekdayOfStart(startLocal: string): number {
  const { y, m, d } = parseLocal(startLocal);
  const nth = Math.ceil(d / 7);
  return d + 7 > daysInMonth(y, m) ? -1 : nth; // last occurrence in the month → -1
}

/** Validates a rule against its start. Returns a list of problems (empty = valid). */
export function validateRule(rule: RecurrenceRule, startLocal: string): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > MAX_INTERVAL) {
    errors.push(`Repeat interval must be between 1 and ${MAX_INTERVAL}`);
  }
  if (rule.freq === "WEEKLY" && rule.byWeekday.length === 0) errors.push("Pick at least one weekday");
  if (rule.endType === "AFTER_COUNT") {
    if (!rule.count || !Number.isInteger(rule.count) || rule.count < 1 || rule.count > MAX_COUNT) {
      errors.push(`Number of occurrences must be between 1 and ${MAX_COUNT}`);
    }
  }
  if (rule.endType === "ON_DATE") {
    if (!rule.untilDate || !isLocalDateTime(`${rule.untilDate}T00:00`)) {
      errors.push("Choose an end date");
    } else if (isLocalDateTime(startLocal) && rule.untilDate < dateOnly(startLocal)) {
      errors.push("The end date must be on or after the first meeting");
    }
  }
  return errors;
}

/** The RRULE line Google expects (including the "RRULE:" prefix). */
export function buildRRule(rule: RecurrenceRule, startLocal: string, tz: string): string {
  const parts: string[] = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);

  if (rule.freq === "WEEKLY") {
    parts.push(`BYDAY=${sortWeekdays(rule.byWeekday).join(",")}`);
  } else if (rule.freq === "MONTHLY") {
    if ((rule.monthlyMode ?? "DAY_OF_MONTH") === "NTH_WEEKDAY") {
      parts.push(`BYDAY=${nthWeekdayOfStart(startLocal)}${weekdayCode(startLocal)}`);
    } else {
      parts.push(`BYMONTHDAY=${parseLocal(startLocal).d}`);
    }
  }
  parts.push("WKST=MO");

  if (rule.endType === "AFTER_COUNT" && rule.count) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.endType === "ON_DATE" && rule.untilDate) {
    // With a TZID start, UNTIL must be a UTC date-time. End of the last day, in the meeting's zone.
    parts.push(`UNTIL=${toRfcUtc(zonedToUtc(`${rule.untilDate}T23:59`, tz))}`);
  }
  return `RRULE:${parts.join(";")}`;
}

function ordinal(n: number): string {
  if (n === -1) return "last";
  return ["", "1st", "2nd", "3rd", "4th", "5th"][n] ?? `${n}th`;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function prettyDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
}

/** "Every weekday", "Every 2 weeks on Mon, Wed · until Dec 31, 2026", … */
export function describeRecurrence(rule: RecurrenceRule, startLocal: string): string {
  const n = rule.interval;
  let base: string;
  switch (rule.freq) {
    case "DAILY":
      base = n === 1 ? "Every day" : `Every ${n} days`;
      break;
    case "WEEKLY": {
      const days = sortWeekdays(rule.byWeekday);
      if (n === 1 && sameSet(days, WEEKDAYS_ONLY)) {
        base = "Every weekday";
      } else {
        const list = days.map((d) => WEEKDAY_LABEL[d]).join(", ");
        base = `${n === 1 ? "Every week" : `Every ${n} weeks`} on ${list}`;
      }
      break;
    }
    case "MONTHLY": {
      const every = n === 1 ? "Every month" : `Every ${n} months`;
      if ((rule.monthlyMode ?? "DAY_OF_MONTH") === "NTH_WEEKDAY") {
        base = `${every} on the ${ordinal(nthWeekdayOfStart(startLocal))} ${WEEKDAY_LONG[weekdayCode(startLocal)]}`;
      } else {
        base = `${every} on day ${parseLocal(startLocal).d}`;
      }
      break;
    }
    case "YEARLY": {
      const { m, d } = parseLocal(startLocal);
      base = `${n === 1 ? "Every year" : `Every ${n} years`} on ${MONTH_SHORT[m - 1]} ${d}`;
      break;
    }
  }
  if (rule.endType === "ON_DATE" && rule.untilDate) base += ` · until ${prettyDate(rule.untilDate)}`;
  else if (rule.endType === "AFTER_COUNT" && rule.count) base += ` · ${rule.count} time${rule.count === 1 ? "" : "s"}`;
  return base;
}

// ── Occurrence generation ───────────────────────────────────────────────────

export interface GenerateOptions {
  /** Only return occurrences at/after this local date-time. */
  from?: string;
  /** Only return occurrences at/before this local date-time. */
  to?: string;
  /** Maximum number of results. */
  limit?: number;
}

const MAX_ITERATIONS = 20_000;

/**
 * Local start date-times of each occurrence, in order. COUNT is measured from the
 * series start (not from `from`), exactly like a calendar would.
 */
export function generateOccurrences(rule: RecurrenceRule, startLocal: string, opts: GenerateOptions = {}): string[] {
  const limit = opts.limit ?? 50;
  const out: string[] = [];
  const start = parseLocal(startLocal);
  const time = { h: start.h, mi: start.mi };
  const untilKey = rule.endType === "ON_DATE" && rule.untilDate ? `${rule.untilDate}T23:59` : null;
  const maxCount = rule.endType === "AFTER_COUNT" ? (rule.count ?? 0) : Infinity;
  let produced = 0;
  let iterations = 0;

  /** Returns false when generation must stop. */
  const emit = (ymd: { y: number; m: number; d: number }): boolean => {
    const local = toLocal({ ...ymd, ...time });
    if (local < startLocal) return true; // before the series begins (weekly first week)
    if (untilKey && local > untilKey) return false;
    if (opts.to && local > opts.to) return false;
    produced++;
    if (produced > maxCount) return false;
    if (!opts.from || local >= opts.from) out.push(local);
    return out.length < limit;
  };

  const ymdOf = (local: string) => {
    const p = parseLocal(local);
    return { y: p.y, m: p.m, d: p.d };
  };

  if (rule.freq === "DAILY") {
    for (let k = 0; iterations++ < MAX_ITERATIONS; k++) {
      if (!emit(ymdOf(addDays(startLocal, k * rule.interval)))) break;
    }
  } else if (rule.freq === "WEEKLY") {
    const days = sortWeekdays(rule.byWeekday.length ? rule.byWeekday : [weekdayCode(startLocal)]);
    // Monday of the week containing the start (weeks start on Monday, WKST=MO).
    const sinceMonday = (weekdayOf(startLocal) + 6) % 7;
    const monday0 = addDays(startLocal, -sinceMonday);
    outer: for (let w = 0; iterations++ < MAX_ITERATIONS; w++) {
      const base = addDays(monday0, w * rule.interval * 7);
      for (const code of days) {
        if (!emit(ymdOf(addDays(base, WEEKDAYS.indexOf(code))))) break outer;
      }
    }
  } else if (rule.freq === "MONTHLY") {
    const mode = rule.monthlyMode ?? "DAY_OF_MONTH";
    const nth = nthWeekdayOfStart(startLocal);
    const wd = weekdayOf(startLocal);
    for (let k = 0; iterations++ < MAX_ITERATIONS; k++) {
      const total = start.y * 12 + (start.m - 1) + k * rule.interval;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      let d: number | null = null;
      if (mode === "DAY_OF_MONTH") {
        d = start.d <= daysInMonth(y, m) ? start.d : null; // months without that day are skipped
      } else {
        const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
        const first = 1 + ((wd - firstWd + 7) % 7);
        if (nth === -1) {
          const dim = daysInMonth(y, m);
          d = first + 7 * Math.floor((dim - first) / 7);
        } else {
          d = first + 7 * (nth - 1);
          if (d > daysInMonth(y, m)) d = null;
        }
      }
      if (d !== null && !emit({ y, m, d })) break;
      // Guard: nothing can still be produced past the horizon.
      if (opts.to && toLocal({ y, m, d: 1, ...time }) > opts.to) break;
    }
  } else {
    for (let k = 0; iterations++ < MAX_ITERATIONS; k++) {
      const y = start.y + k * rule.interval;
      if (start.m === 2 && start.d === 29 && daysInMonth(y, 2) < 29) continue; // Feb 29 only in leap years
      if (!emit({ y, m: start.m, d: start.d })) break;
      if (opts.to && toLocal({ y, m: 1, d: 1, ...time }) > opts.to) break;
    }
  }
  return out;
}
