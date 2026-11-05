"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptValue } from "@/lib/encryption";
import { getActiveProject } from "@/lib/project";
import { ActionError, done, fail, notify, requireActor, toResult, type Result, type SessionActor } from "@/lib/page-tracker/server";
import { zonedToUtc } from "@/lib/meetings/time";
import { buildRRule, type RecurrenceRule } from "@/lib/meetings/recurrence";
import { meetingInputSchema, occurrenceSchema, rescheduleOccurrenceSchema, type MeetingInput } from "@/lib/meetings/validators";
import { listCalendars, revokeToken } from "@/lib/meetings/google";
import {
  MeetingError,
  cancelMeetingOnGoogle,
  cancelOccurrenceOnGoogle,
  getAccessToken,
  getConnection,
  pullFromGoogle,
  syncWithGoogle,
  getAttendance,
  type SyncOutcome,
  type AttendanceResult,
  pushMeeting,
  rescheduleOccurrenceOnGoogle,
} from "@/lib/meetings/service";

const idSchema = z.string().cuid();
const PAST_GRACE_MS = 5 * 60_000;

/**
 * Any signed-in, active team member can schedule, edit and cancel meetings once an admin
 * has connected the team Google account. The session alone isn't enough — a deactivated
 * user can still hold a valid JWT — so the account is re-checked against the database.
 * Only the Google connection itself stays admin-only — see requireAdmin.
 */
async function requireScheduler(actor: SessionActor) {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { isActive: true } });
  if (!user?.isActive) throw new ActionError("Your account is inactive — ask an admin to restore access");
}
function requireAdmin(actor: SessionActor) {
  if (actor.role !== "ADMIN") throw new ActionError("Only an admin can manage the Google connection");
}

function ruleOf(input: MeetingInput): RecurrenceRule | null {
  if (input.kind !== "RECURRING" || !input.recurrence) return null;
  const r = input.recurrence;
  return {
    freq: r.freq,
    interval: r.interval,
    byWeekday: r.byWeekday,
    monthlyMode: r.freq === "MONTHLY" ? (r.monthlyMode ?? "DAY_OF_MONTH") : null,
    endType: r.endType,
    untilDate: r.endType === "ON_DATE" ? (r.untilDate ?? null) : null,
    count: r.endType === "AFTER_COUNT" ? (r.count ?? null) : null,
  };
}

/** Everything that decides *when* occurrences happen (changing it resets edited occurrences in Google). */
function scheduleSignature(m: { startLocal: string; timezone: string; durationMin: number; rrule: string | null }) {
  return [m.startLocal, m.timezone, m.durationMin, m.rrule ?? ""].join("|");
}

async function ensureAttendeesExist(input: MeetingInput) {
  const ids = input.attendees.map((a) => a.userId).filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const found = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  if (found.length !== new Set(ids).size) throw new ActionError("One of the selected team members is no longer active");
}

function dataFromInput(input: MeetingInput) {
  const rule = ruleOf(input);
  return {
    title: input.title,
    description: input.description || null,
    kind: input.kind,
    startLocal: input.startLocal,
    timezone: input.timezone,
    durationMin: input.durationMin,
    startUtc: zonedToUtc(input.startLocal, input.timezone),
    freq: rule?.freq ?? null,
    interval: rule?.interval ?? 1,
    byWeekday: rule?.byWeekday ?? [],
    monthlyMode: rule?.monthlyMode ?? null,
    endType: rule?.endType ?? ("NEVER" as const),
    untilDate: rule?.untilDate ?? null,
    occurrenceCount: rule?.count ?? null,
    rrule: rule ? buildRRule(rule, input.startLocal, input.timezone) : null,
    addMeet: input.addMeet,
    sendInvites: input.sendInvites,
    guestsCanModify: input.guestsCanModify,
    guestsCanInvite: input.guestsCanInvite,
    guestsCanSeeOthers: input.guestsCanSeeOthers,
    reminderMinutes: input.reminderMinutes ?? null,
  };
}

async function notifyAttendees(actor: SessionActor, meetingId: string, title: string, verb: string, userIds: (string | null)[]) {
  await notify({
    userIds,
    actorId: actor.id,
    type: "MEETING",
    title: `${actor.displayName} ${verb} a meeting`,
    body: title,
    link: `/meetings?meeting=${meetingId}`,
  });
}

export interface SaveResult {
  id: string;
  /** false → saved in IFlow but Google rejected/failed it; `syncError` explains and the meeting can be retried. */
  synced: boolean;
  syncError?: string;
  meetUrl: string | null;
}

// ── create ──────────────────────────────────────────────────────────────────

export async function createMeeting(raw: unknown): Promise<Result<SaveResult>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    const parsed = meetingInputSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const input = parsed.data;

    const project = await getActiveProject();
    if (!project) return fail("No active project");
    if (zonedToUtc(input.startLocal, input.timezone).getTime() < Date.now() - PAST_GRACE_MS) {
      return fail("The first meeting is in the past — pick a later date or time");
    }
    await ensureAttendeesExist(input);
    await getAccessToken(); // fail fast (with a clear message) before saving anything if Google isn't usable

    const meeting = await prisma.meeting.create({
      data: {
        ...dataFromInput(input),
        projectId: project.id,
        createdById: actor.id,
        updatedById: actor.id,
        syncStatus: "PENDING",
        attendees: {
          create: input.attendees.map((a) => ({
            userId: a.userId ?? null,
            email: a.email,
            displayName: a.displayName ?? null,
            optional: a.optional,
          })),
        },
      },
    });

    const sync = await pushMeeting(meeting.id);
    await notifyAttendees(actor, meeting.id, meeting.title, "scheduled", input.attendees.map((a) => a.userId ?? null));
    return done({ id: meeting.id, synced: sync.ok, syncError: sync.ok ? undefined : sync.error, meetUrl: sync.ok ? sync.meetUrl : null });
  } catch (e) {
    if (e instanceof MeetingError) return fail(e.message);
    return toResult(e, "createMeeting");
  }
}

// ── update ──────────────────────────────────────────────────────────────────

export async function updateMeeting(meetingId: string, raw: unknown): Promise<Result<SaveResult>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    if (!idSchema.safeParse(meetingId).success) return fail("Invalid request");
    const parsed = meetingInputSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const input = parsed.data;

    const existing = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { attendees: true } });
    if (!existing) return fail("Meeting not found");
    if (existing.status === "CANCELLED") return fail("This meeting is cancelled and can't be edited");
    if (existing.kind !== input.kind) return fail("A one-time meeting can't be turned into a series (or the reverse). Cancel it and schedule a new one.");

    const next = dataFromInput(input);
    const scheduleChanged = scheduleSignature(existing) !== scheduleSignature(next);
    if (scheduleChanged && next.startUtc.getTime() < Date.now() - PAST_GRACE_MS && input.kind === "ONE_TIME") {
      return fail("That time is in the past — pick a later date or time");
    }
    await ensureAttendeesExist(input);
    await getAccessToken();

    await prisma.$transaction(async (tx) => {
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          ...next,
          // Turning Meet off after a link exists isn't possible in Google; keep it on.
          addMeet: existing.meetUrl ? true : next.addMeet,
          updatedById: actor.id,
          syncStatus: "PENDING",
          lastError: null,
        },
      });
      await tx.meetingAttendee.deleteMany({ where: { meetingId } });
      if (input.attendees.length) {
        await tx.meetingAttendee.createMany({
          data: input.attendees.map((a) => ({
            meetingId,
            userId: a.userId ?? null,
            email: a.email,
            displayName: a.displayName ?? null,
            optional: a.optional,
          })),
        });
      }
      // Google resets edited/cancelled occurrences when the series rule or time changes.
      if (scheduleChanged) await tx.meetingException.deleteMany({ where: { meetingId } });
    });

    const sync = await pushMeeting(meetingId);
    const everyone = new Set([...existing.attendees.map((a) => a.userId), ...input.attendees.map((a) => a.userId ?? null)]);
    await notifyAttendees(actor, meetingId, input.title, "updated", [...everyone]);
    return done({ id: meetingId, synced: sync.ok, syncError: sync.ok ? undefined : sync.error, meetUrl: sync.ok ? sync.meetUrl : existing.meetUrl });
  } catch (e) {
    if (e instanceof MeetingError) return fail(e.message);
    return toResult(e, "updateMeeting");
  }
}

// ── cancel / occurrences / sync ─────────────────────────────────────────────

export async function cancelMeeting(input: { meetingId: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    if (!idSchema.safeParse(input?.meetingId).success) return fail("Invalid request");
    const m = await prisma.meeting.findUnique({ where: { id: input.meetingId }, include: { attendees: true } });
    if (!m) return fail("Meeting not found");
    if (m.status === "CANCELLED") return done(undefined);
    const res = await cancelMeetingOnGoogle(m.id);
    if (!res.ok) return fail(res.error);
    await notifyAttendees(actor, m.id, m.title, "cancelled", m.attendees.map((a) => a.userId));
    return done(undefined);
  } catch (e) {
    return toResult(e, "cancelMeeting");
  }
}

export async function cancelOccurrence(raw: unknown): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    const parsed = occurrenceSchema.safeParse(raw);
    if (!parsed.success) return fail("Invalid request");
    const m = await prisma.meeting.findUnique({ where: { id: parsed.data.meetingId }, include: { attendees: true } });
    if (!m || m.kind !== "RECURRING") return fail("Only a recurring meeting has occurrences");
    if (m.status === "CANCELLED") return fail("This meeting is cancelled");
    const res = await cancelOccurrenceOnGoogle(m.id, parsed.data.originalStartLocal);
    if (!res.ok) return fail(res.error);
    await notifyAttendees(actor, m.id, `${m.title} (${parsed.data.originalStartLocal.slice(0, 10)})`, "cancelled one occurrence of", m.attendees.map((a) => a.userId));
    return done(undefined);
  } catch (e) {
    return toResult(e, "cancelOccurrence");
  }
}

export async function rescheduleOccurrence(raw: unknown): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    const parsed = rescheduleOccurrenceSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const v = parsed.data;
    const m = await prisma.meeting.findUnique({ where: { id: v.meetingId }, include: { attendees: true } });
    if (!m || m.kind !== "RECURRING") return fail("Only a recurring meeting has occurrences");
    if (m.status === "CANCELLED") return fail("This meeting is cancelled");
    if (zonedToUtc(v.newStartLocal, m.timezone).getTime() < Date.now() - PAST_GRACE_MS) return fail("That time is in the past");
    const res = await rescheduleOccurrenceOnGoogle(m.id, v.originalStartLocal, v.newStartLocal, v.newDurationMin);
    if (!res.ok) return fail(res.error);
    await notifyAttendees(actor, m.id, `${m.title} (${v.originalStartLocal.slice(0, 10)})`, "rescheduled one occurrence of", m.attendees.map((a) => a.userId));
    return done(undefined);
  } catch (e) {
    return toResult(e, "rescheduleOccurrence");
  }
}

export async function retrySync(input: { meetingId: string }): Promise<Result<SaveResult>> {
  try {
    const actor = await requireActor();
    await requireScheduler(actor);
    if (!idSchema.safeParse(input?.meetingId).success) return fail("Invalid request");
    const m = await prisma.meeting.findUnique({ where: { id: input.meetingId } });
    if (!m) return fail("Meeting not found");
    if (m.status === "CANCELLED") return fail("This meeting is cancelled");
    const sync = await pushMeeting(m.id);
    return done({ id: m.id, synced: sync.ok, syncError: sync.ok ? undefined : sync.error, meetUrl: sync.ok ? sync.meetUrl : m.meetUrl });
  } catch (e) {
    return toResult(e, "retrySync");
  }
}

/**
 * Sync with Google Calendar: mirrors deletions/edits made in Google onto IFlow meetings and
 * returns the calendar's other (non-IFlow) meetings for display. Any team member may call it.
 */
export async function syncMeetings(input?: { force?: boolean }): Promise<Result<SyncOutcome & { connected: boolean }>> {
  try {
    await requireActor();
    const project = await getActiveProject();
    if (!project) return fail("No active project");
    const conn = await getConnection();
    if (!conn || conn.status !== "ACTIVE") return done({ connected: false, changed: 0, external: [], syncedAt: new Date().toISOString() });
    const outcome = await syncWithGoogle(project.id, !!input?.force);
    return done({ connected: true, ...outcome });
  } catch (e) {
    if (e instanceof MeetingError) return fail(e.message);
    return toResult(e, "syncMeetings");
  }
}

/** Who joined the calls held on this meeting's Meet link (last 30 days). */
export async function getMeetingAttendance(input: { meetingId: string }): Promise<Result<AttendanceResult>> {
  try {
    await requireActor();
    if (!idSchema.safeParse(input?.meetingId).success) return fail("Invalid request");
    return done(await getAttendance(input.meetingId));
  } catch (e) {
    return toResult(e, "getMeetingAttendance");
  }
}

/** Pull changes someone made directly in Google Calendar (title, time, Meet link, cancellation). */
export async function refreshMeeting(input: { meetingId: string }): Promise<Result<{ changed: boolean }>> {
  try {
    await requireActor();
    if (!idSchema.safeParse(input?.meetingId).success) return fail("Invalid request");
    const res = await pullFromGoogle(input.meetingId);
    return res.ok ? done({ changed: res.changed }) : fail(res.error);
  } catch (e) {
    return toResult(e, "refreshMeeting");
  }
}

// ── team member emails ──────────────────────────────────────────────────────

/** Google invites need an email; users have none, so whoever schedules saves one here (once per person). */
export async function saveMemberEmail(input: { userId: string; email: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = z.object({ userId: z.string().cuid(), email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address") }).safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    await requireScheduler(actor);
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, isActive: true } });
    if (!user?.isActive) return fail("User not found");
    await prisma.memberEmail.upsert({
      where: { userId: parsed.data.userId },
      create: { userId: parsed.data.userId, email: parsed.data.email },
      update: { email: parsed.data.email },
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "saveMemberEmail");
  }
}

// ── Google connection (admin) ───────────────────────────────────────────────

export async function listGoogleCalendars(): Promise<Result<{ id: string; summary: string; primary: boolean }[]>> {
  try {
    const actor = await requireActor();
    requireAdmin(actor);
    const { token } = await getAccessToken();
    const items = await listCalendars(token);
    return done(items.map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary })));
  } catch (e) {
    if (e instanceof MeetingError) return fail(e.message);
    return toResult(e, "listGoogleCalendars");
  }
}

export async function setGoogleCalendar(input: { calendarId: string; calendarName: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    requireAdmin(actor);
    const parsed = z.object({ calendarId: z.string().min(1).max(300), calendarName: z.string().max(300) }).safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const { token } = await getAccessToken();
    const items = await listCalendars(token);
    if (!items.some((c) => c.id === parsed.data.calendarId)) return fail("The connected Google account can't write to that calendar");
    await prisma.googleConnection.update({ where: { id: "workspace" }, data: { calendarId: parsed.data.calendarId, calendarName: parsed.data.calendarName } });
    return done(undefined);
  } catch (e) {
    if (e instanceof MeetingError) return fail(e.message);
    return toResult(e, "setGoogleCalendar");
  }
}

export async function disconnectGoogle(): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    requireAdmin(actor);
    const conn = await getConnection();
    if (conn) {
      const refresh = decryptValue(conn.refreshTokenEnc);
      if (refresh && !refresh.includes("DECRYPTION_FAILED")) await revokeToken(refresh);
      await prisma.googleConnection.delete({ where: { id: "workspace" } });
    }
    return done(undefined);
  } catch (e) {
    return toResult(e, "disconnectGoogle");
  }
}
