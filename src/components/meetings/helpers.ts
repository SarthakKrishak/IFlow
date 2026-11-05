import type { MeetingRow } from "@/lib/meetings/queries";
import { describeRecurrence, generateOccurrences, type RecurrenceRule, type Weekday } from "@/lib/meetings/recurrence";
import { formatInZone, utcToZoned, zoneAbbr, zonedToUtc } from "@/lib/meetings/time";

export function ruleFromRow(m: Pick<MeetingRow, "kind" | "freq" | "interval" | "byWeekday" | "monthlyMode" | "endType" | "untilDate" | "occurrenceCount">): RecurrenceRule | null {
  if (m.kind !== "RECURRING" || !m.freq) return null;
  return {
    freq: m.freq,
    interval: m.interval,
    byWeekday: m.byWeekday as Weekday[],
    monthlyMode: m.monthlyMode,
    endType: m.endType,
    untilDate: m.untilDate,
    count: m.occurrenceCount,
  };
}

export function scheduleSummary(m: MeetingRow): string {
  const rule = ruleFromRow(m);
  return rule ? describeRecurrence(rule, m.startLocal) : "One time";
}

export interface Occurrence {
  key: string;
  meeting: MeetingRow;
  /** The occurrence's ORIGINAL local start (identifies it for edits/cancels). */
  originalStartLocal: string;
  startLocal: string;
  durationMin: number;
  start: Date;
  end: Date;
  moved: boolean;
}

/** Occurrences from `now` to `now + horizonDays`, with edited/cancelled ones applied. */
export function upcomingOccurrences(meetings: MeetingRow[], now: Date, horizonDays: number): Occurrence[] {
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
  const out: Occurrence[] = [];

  for (const m of meetings) {
    if (m.status !== "ACTIVE") continue;
    const rule = ruleFromRow(m);
    const starts = rule
      ? generateOccurrences(rule, m.startLocal, {
          from: utcToZoned(new Date(now.getTime() - 86_400_000), m.timezone),
          to: utcToZoned(new Date(horizon.getTime() + 86_400_000), m.timezone),
          limit: 60,
        })
      : [m.startLocal];

    for (const original of starts) {
      const ex = m.exceptions.find((e) => e.originalStartLocal === original);
      if (ex?.type === "CANCELLED") continue;
      const startLocal = ex?.type === "MODIFIED" && ex.newStartLocal ? ex.newStartLocal : original;
      const durationMin = ex?.type === "MODIFIED" && ex.newDurationMin ? ex.newDurationMin : m.durationMin;
      const start = zonedToUtc(startLocal, m.timezone);
      const end = new Date(start.getTime() + durationMin * 60_000);
      if (end < now || start > horizon) continue;
      out.push({ key: `${m.id}:${original}`, meeting: m, originalStartLocal: original, startLocal, durationMin, start, end, moved: ex?.type === "MODIFIED" });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/** "10:00 AM – 11:00 AM IST" in the meeting's own zone. */
export function timeRange(start: Date, end: Date, tz: string): string {
  return `${formatInZone(start, tz, TIME)} – ${formatInZone(end, tz, TIME)} ${zoneAbbr(start, tz)}`;
}

/** "4:30 AM – 5:30 AM your time" — only when the viewer's zone differs. */
export function viewerNote(start: Date, end: Date, meetingTz: string, viewerTz: string): string | null {
  if (!viewerTz || viewerTz === meetingTz) return null;
  const a = formatInZone(start, viewerTz, TIME);
  const b = formatInZone(end, viewerTz, TIME);
  const sameOffset = zoneAbbr(start, viewerTz) === zoneAbbr(start, meetingTz);
  return sameOffset ? null : `${a} – ${b} your time`;
}

export function dayHeading(date: Date, tz: string, now: Date): string {
  const key = (d: Date) => formatInZone(d, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
  const today = key(now);
  const tomorrow = key(new Date(now.getTime() + 86_400_000));
  const k = key(date);
  const label = formatInZone(date, tz, { weekday: "long", month: "long", day: "numeric" });
  if (k === today) return `Today · ${label}`;
  if (k === tomorrow) return `Tomorrow · ${label}`;
  return label;
}

export const dayKey = (date: Date, tz: string) => formatInZone(date, tz, { year: "numeric", month: "2-digit", day: "2-digit" });

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
