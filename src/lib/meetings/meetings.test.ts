import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  endLocal,
  isLocalDateTime,
  isValidTimeZone,
  toRfcUtc,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from "./time";
import { buildRRule, describeRecurrence, generateOccurrences, nthWeekdayOfStart, validateRule, type RecurrenceRule } from "./recurrence";
import { buildDescription, buildEventResource, buildInstancePatch, extractMeetUrl, googleEventIdFor, type EventInput } from "./event";
import { meetingInputSchema } from "./validators";

const rule = (over: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  freq: "WEEKLY",
  interval: 1,
  byWeekday: ["MO"],
  monthlyMode: null,
  endType: "NEVER",
  untilDate: null,
  count: null,
  ...over,
});

// ── time ────────────────────────────────────────────────────────────────────

test("zonedToUtc: fixed-offset zone (Asia/Kolkata is UTC+5:30)", () => {
  assert.equal(zonedToUtc("2026-11-10T10:00", "Asia/Kolkata").toISOString(), "2026-11-10T04:30:00.000Z");
});

test("zonedToUtc: DST is respected on both sides of the change (New York)", () => {
  assert.equal(zonedToUtc("2026-01-15T09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z"); // EST
  assert.equal(zonedToUtc("2026-07-15T09:00", "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z"); // EDT
  assert.equal(zonedToUtc("2026-03-08T12:00", "America/New_York").toISOString(), "2026-03-08T16:00:00.000Z"); // day DST starts
});

test("zonedToUtc ↔ utcToZoned round-trip", () => {
  for (const [local, tz] of [
    ["2026-11-10T10:00", "Asia/Kolkata"],
    ["2026-07-04T23:45", "America/Los_Angeles"],
    ["2026-12-31T00:00", "Australia/Sydney"],
    ["2026-06-01T12:30", "UTC"],
  ] as const) {
    assert.equal(utcToZoned(zonedToUtc(local, tz), tz), local);
  }
});

test("a time that doesn't exist (spring-forward gap) still resolves without throwing", () => {
  const d = zonedToUtc("2026-03-08T02:30", "America/New_York");
  assert.ok(!Number.isNaN(d.getTime()));
});

test("endLocal measures real elapsed time", () => {
  assert.equal(endLocal("2026-11-10T10:00", "Asia/Kolkata", 90), "2026-11-10T11:30");
  assert.equal(endLocal("2026-11-10T23:30", "Asia/Kolkata", 60), "2026-11-11T00:30");
});

test("local-string helpers", () => {
  assert.equal(addDays("2026-11-30T10:00", 1), "2026-12-01T10:00");
  assert.equal(addDays("2026-03-01T10:00", -1), "2026-02-28T10:00");
  assert.equal(weekdayOf("2026-11-10T10:00"), 2); // Tuesday
  assert.ok(isLocalDateTime("2026-02-28T10:00"));
  assert.ok(!isLocalDateTime("2026-02-30T10:00"));
  assert.ok(!isLocalDateTime("2026-13-01T10:00"));
  assert.ok(!isLocalDateTime("2026-01-01T25:00"));
  assert.ok(!isLocalDateTime("tomorrow"));
});

test("time zone validation", () => {
  assert.ok(isValidTimeZone("Asia/Kolkata"));
  assert.ok(isValidTimeZone("UTC"));
  assert.ok(!isValidTimeZone("Mars/Olympus"));
  assert.ok(!isValidTimeZone(""));
});

test("toRfcUtc", () => {
  assert.equal(toRfcUtc(new Date("2026-12-31T18:29:00.000Z")), "20261231T182900Z");
});

// ── RRULE ───────────────────────────────────────────────────────────────────

test("RRULE: weekly on selected days, Monday week start", () => {
  assert.equal(buildRRule(rule({ byWeekday: ["WE", "MO"] }), "2026-11-09T10:00", "Asia/Kolkata"), "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;WKST=MO");
});

test("RRULE: interval, count and until (until = end of that day in the meeting's zone, as UTC)", () => {
  assert.equal(
    buildRRule(rule({ interval: 2, endType: "AFTER_COUNT", count: 10 }), "2026-11-09T10:00", "UTC"),
    "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;WKST=MO;COUNT=10"
  );
  assert.equal(
    buildRRule(rule({ freq: "DAILY", byWeekday: [], endType: "ON_DATE", untilDate: "2026-12-31" }), "2026-11-09T10:00", "Asia/Kolkata"),
    "RRULE:FREQ=DAILY;WKST=MO;UNTIL=20261231T182900Z" // 23:59 IST = 18:29 UTC
  );
});

test("RRULE: monthly by day-of-month and by nth weekday (incl. 'last')", () => {
  assert.equal(
    buildRRule(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "DAY_OF_MONTH" }), "2026-11-10T10:00", "UTC"),
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=10;WKST=MO"
  );
  assert.equal(
    buildRRule(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "NTH_WEEKDAY" }), "2026-11-10T10:00", "UTC"),
    "RRULE:FREQ=MONTHLY;BYDAY=2TU;WKST=MO"
  );
  assert.equal(nthWeekdayOfStart("2026-11-24T10:00"), -1); // last Tuesday of November
  assert.equal(
    buildRRule(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "NTH_WEEKDAY" }), "2026-11-24T10:00", "UTC"),
    "RRULE:FREQ=MONTHLY;BYDAY=-1TU;WKST=MO"
  );
});

test("rule validation", () => {
  assert.deepEqual(validateRule(rule(), "2026-11-09T10:00"), []);
  assert.ok(validateRule(rule({ byWeekday: [] }), "2026-11-09T10:00").length > 0);
  assert.ok(validateRule(rule({ interval: 0 }), "2026-11-09T10:00").length > 0);
  assert.ok(validateRule(rule({ endType: "AFTER_COUNT", count: 0 }), "2026-11-09T10:00").length > 0);
  assert.ok(validateRule(rule({ endType: "ON_DATE", untilDate: "2026-01-01" }), "2026-11-09T10:00").length > 0);
  assert.ok(validateRule(rule({ endType: "ON_DATE", untilDate: null }), "2026-11-09T10:00").length > 0);
});

test("describeRecurrence", () => {
  const start = "2026-11-09T10:00";
  assert.equal(describeRecurrence(rule({ byWeekday: ["MO", "TU", "WE", "TH", "FR"] }), start), "Every weekday");
  assert.equal(describeRecurrence(rule({ freq: "DAILY", byWeekday: [] }), start), "Every day");
  assert.equal(describeRecurrence(rule({ interval: 2, byWeekday: ["WE", "MO"], endType: "AFTER_COUNT", count: 10 }), start), "Every 2 weeks on Mon, Wed · 10 times");
  assert.equal(describeRecurrence(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "NTH_WEEKDAY" }), "2026-11-10T10:00"), "Every month on the 2nd Tuesday");
  assert.equal(describeRecurrence(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "DAY_OF_MONTH" }), "2026-11-10T10:00"), "Every month on day 10");
  assert.equal(describeRecurrence(rule({ freq: "YEARLY", byWeekday: [], endType: "ON_DATE", untilDate: "2030-01-01" }), "2026-11-10T10:00"), "Every year on Nov 10 · until Jan 1, 2030");
});

// ── occurrence generation ───────────────────────────────────────────────────

test("weekly: starts mid-week and honours several weekdays", () => {
  // 2026-11-10 is a Tuesday; Mon+Wed series → first hit is Wed 11-11
  const got = generateOccurrences(rule({ byWeekday: ["MO", "WE"] }), "2026-11-10T10:00", { limit: 4 });
  assert.deepEqual(got, ["2026-11-11T10:00", "2026-11-16T10:00", "2026-11-18T10:00", "2026-11-23T10:00"]);
});

test("weekly: bi-weekly skips alternate weeks", () => {
  const got = generateOccurrences(rule({ interval: 2 }), "2026-11-09T10:00", { limit: 3 });
  assert.deepEqual(got, ["2026-11-09T10:00", "2026-11-23T10:00", "2026-12-07T10:00"]);
});

test("daily: COUNT is measured from the series start, not from the query window", () => {
  const r = rule({ freq: "DAILY", byWeekday: [], endType: "AFTER_COUNT", count: 3 });
  assert.deepEqual(generateOccurrences(r, "2026-11-09T10:00"), ["2026-11-09T10:00", "2026-11-10T10:00", "2026-11-11T10:00"]);
  assert.deepEqual(generateOccurrences(r, "2026-11-09T10:00", { from: "2026-11-11T00:00" }), ["2026-11-11T10:00"]);
  assert.deepEqual(generateOccurrences(r, "2026-11-09T10:00", { from: "2026-12-01T00:00" }), []);
});

test("UNTIL is inclusive of the last day", () => {
  const r = rule({ freq: "DAILY", byWeekday: [], endType: "ON_DATE", untilDate: "2026-11-11" });
  assert.deepEqual(generateOccurrences(r, "2026-11-09T10:00"), ["2026-11-09T10:00", "2026-11-10T10:00", "2026-11-11T10:00"]);
});

test("monthly by day: months without that day are skipped", () => {
  const got = generateOccurrences(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "DAY_OF_MONTH" }), "2026-01-31T09:00", { limit: 4 });
  assert.deepEqual(got, ["2026-01-31T09:00", "2026-03-31T09:00", "2026-05-31T09:00", "2026-07-31T09:00"]);
});

test("monthly by nth weekday", () => {
  const got = generateOccurrences(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "NTH_WEEKDAY" }), "2026-11-10T10:00", { limit: 3 });
  assert.deepEqual(got, ["2026-11-10T10:00", "2026-12-08T10:00", "2027-01-12T10:00"]);
});

test("monthly 'last weekday'", () => {
  const got = generateOccurrences(rule({ freq: "MONTHLY", byWeekday: [], monthlyMode: "NTH_WEEKDAY" }), "2026-11-24T10:00", { limit: 3 });
  assert.deepEqual(got, ["2026-11-24T10:00", "2026-12-29T10:00", "2027-01-26T10:00"]); // last Tuesdays
});

test("yearly: Feb 29 only occurs in leap years", () => {
  const got = generateOccurrences(rule({ freq: "YEARLY", byWeekday: [] }), "2024-02-29T10:00", { limit: 3 });
  assert.deepEqual(got, ["2024-02-29T10:00", "2028-02-29T10:00", "2032-02-29T10:00"]);
});

test("the wall-clock time never shifts (DST-safe by construction)", () => {
  const got = generateOccurrences(rule({ freq: "DAILY", byWeekday: [] }), "2026-03-06T09:00", { limit: 5 });
  assert.ok(got.every((g) => g.endsWith("T09:00")));
});

test("`to` bound stops generation", () => {
  const got = generateOccurrences(rule({ freq: "DAILY", byWeekday: [] }), "2026-11-09T10:00", { to: "2026-11-11T09:00", limit: 99 });
  assert.deepEqual(got, ["2026-11-09T10:00", "2026-11-10T10:00"]);
});

// ── Google event mapping ────────────────────────────────────────────────────

const input = (over: Partial<EventInput> = {}): EventInput => ({
  meetingId: "cmabc123",
  title: "  Daily stand-up ",
  description: "Quick sync",
  startLocal: "2026-11-10T10:00",
  timezone: "Asia/Kolkata",
  durationMin: 90,
  rrule: null,
  attendees: [
    { email: "Priya@Example.com", displayName: "Priya", optional: false },
    { email: "raj@example.com", optional: true },
  ],
  guestsCanModify: false,
  guestsCanInvite: false,
  guestsCanSeeOthers: true,
  reminderMinutes: 10,
  ...over,
});

test("event id is a valid base32hex string and deterministic", () => {
  const id = googleEventIdFor("cmabc123");
  assert.match(id, /^[0-9a-v]{5,1024}$/);
  assert.equal(id, googleEventIdFor("cmabc123"));
  assert.notEqual(id, googleEventIdFor("cmabc124"));
});

test("one-time event resource", () => {
  const e = buildEventResource(input(), { includeId: true, conferenceRequestId: "req-1" }) as any;
  assert.equal(e.summary, "Daily stand-up");
  assert.equal(e.id, googleEventIdFor("cmabc123"));
  assert.deepEqual(e.start, { dateTime: "2026-11-10T10:00:00", timeZone: "Asia/Kolkata" });
  assert.deepEqual(e.end, { dateTime: "2026-11-10T11:30:00", timeZone: "Asia/Kolkata" });
  assert.equal(e.recurrence, undefined);
  assert.deepEqual(e.attendees, [{ email: "priya@example.com", displayName: "Priya" }, { email: "raj@example.com", optional: true }]);
  assert.deepEqual(e.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
  assert.equal(e.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.equal(e.conferenceData.createRequest.requestId, "req-1");
  assert.equal(e.extendedProperties.private.iflowMeetingId, "cmabc123");
  assert.match(e.description, /Quick sync[\s\S]*Scheduled with IFlow/);
});

test("recurring event carries the RRULE; no conference or id unless requested", () => {
  const e = buildEventResource(input({ rrule: "RRULE:FREQ=DAILY;WKST=MO", reminderMinutes: null })) as any;
  assert.deepEqual(e.recurrence, ["RRULE:FREQ=DAILY;WKST=MO"]);
  assert.equal(e.conferenceData, undefined);
  assert.equal(e.id, undefined);
  assert.deepEqual(e.reminders, { useDefault: true });
});

test("guest permissions are passed through", () => {
  const e = buildEventResource(input({ guestsCanModify: true, guestsCanInvite: true, guestsCanSeeOthers: false })) as any;
  assert.equal(e.guestsCanModify, true);
  assert.equal(e.guestsCanInviteOthers, true);
  assert.equal(e.guestsCanSeeOtherGuests, false);
});

test("single-occurrence patch moves and resizes only that instance", () => {
  const p = buildInstancePatch({ startLocal: "2026-11-12T15:00", timezone: "Asia/Kolkata", durationMin: 30 }) as any;
  assert.deepEqual(p.start, { dateTime: "2026-11-12T15:00:00", timeZone: "Asia/Kolkata" });
  assert.deepEqual(p.end, { dateTime: "2026-11-12T15:30:00", timeZone: "Asia/Kolkata" });
  assert.equal(p.summary, undefined);
  assert.equal(p.recurrence, undefined);
});

test("description footer, and Meet-link extraction", () => {
  assert.equal(buildDescription(""), "—\nScheduled with IFlow");
  assert.equal(extractMeetUrl({ hangoutLink: "https://meet.google.com/abc-defg-hij" }), "https://meet.google.com/abc-defg-hij");
  assert.equal(extractMeetUrl({ conferenceData: { entryPoints: [{ entryPointType: "phone" }, { entryPointType: "video", uri: "https://meet.google.com/x" }] } }), "https://meet.google.com/x");
  assert.equal(extractMeetUrl({}), null);
});

// ── input validation ────────────────────────────────────────────────────────

const valid = {
  title: "Sprint planning",
  kind: "ONE_TIME" as const,
  startLocal: "2026-11-10T10:00",
  timezone: "Asia/Kolkata",
  durationMin: 60,
  attendees: [{ email: "a@example.com", optional: false }],
};

test("valid one-time meeting parses with safe defaults", () => {
  const r = meetingInputSchema.safeParse(valid);
  assert.ok(r.success);
  if (r.success) {
    assert.equal(r.data.addMeet, true);
    assert.equal(r.data.guestsCanModify, false);
    assert.equal(r.data.guestsCanSeeOthers, true);
  }
});

test("rejects bad times, zones, durations and emails", () => {
  assert.ok(!meetingInputSchema.safeParse({ ...valid, startLocal: "2026-02-30T10:00" }).success);
  assert.ok(!meetingInputSchema.safeParse({ ...valid, timezone: "Nowhere/City" }).success);
  assert.ok(!meetingInputSchema.safeParse({ ...valid, durationMin: 1 }).success);
  assert.ok(!meetingInputSchema.safeParse({ ...valid, durationMin: 5000 }).success);
  assert.ok(!meetingInputSchema.safeParse({ ...valid, title: "   " }).success);
  assert.ok(!meetingInputSchema.safeParse({ ...valid, attendees: [{ email: "not-an-email", optional: false }] }).success);
});

test("rejects duplicate attendees (case-insensitive) and a recurring meeting without a rule", () => {
  assert.ok(
    !meetingInputSchema.safeParse({
      ...valid,
      attendees: [
        { email: "a@example.com", optional: false },
        { email: "A@Example.com", optional: true },
      ],
    }).success
  );
  assert.ok(!meetingInputSchema.safeParse({ ...valid, kind: "RECURRING" }).success);
  assert.ok(
    meetingInputSchema.safeParse({
      ...valid,
      kind: "RECURRING",
      recurrence: { freq: "WEEKLY", interval: 1, byWeekday: ["MO"], endType: "NEVER" },
    }).success
  );
  assert.ok(
    !meetingInputSchema.safeParse({
      ...valid,
      kind: "RECURRING",
      recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [], endType: "NEVER" },
    }).success
  );
});
