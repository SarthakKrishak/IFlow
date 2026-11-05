/**
 * Meetings — server-side orchestration between IFlow's DB and Google Calendar.
 *
 * Source of truth: the IFlow `Meeting` row defines the meeting; Google holds the event
 * (and runs the recurrence, sends invites, owns the Meet link). Every write is recorded
 * as SYNCED / FAILED with a human-readable error so nothing fails silently.
 */

import { prisma } from "@/lib/prisma";
import { decryptValue } from "@/lib/encryption";
import {
  GoogleApiError,
  deleteEvent,
  friendlyGoogleError,
  getEvent,
  googleConfig,
  insertEvent,
  listInstances,
  patchEvent,
  refreshAccessToken,
  type GoogleEvent,
  type SendUpdates,
} from "./google";
import { buildEventResource, buildInstancePatch, extractMeetUrl, googleEventIdFor, type EventInput } from "./event";
import { utcToZoned, zonedToUtc } from "./time";

export class MeetingError extends Error {}

export type SyncResult = { ok: true; meetUrl: string | null } | { ok: false; error: string };

type MeetingWithPeople = NonNullable<Awaited<ReturnType<typeof loadMeeting>>>;

/** The calendar an existing event lives on (falls back to the connection's current one for new events). */
const calFor = (m: { googleEventId: string | null; calendarId: string | null }, current: string) => (m.googleEventId && m.calendarId ? m.calendarId : current);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── connection & access token ───────────────────────────────────────────────

export async function getConnection() {
  return prisma.googleConnection.findUnique({ where: { id: "workspace" } });
}

const g = globalThis as unknown as { __iflowGoogleToken?: { key: string; token: string; exp: number } };

export async function getAccessToken(): Promise<{ token: string; calendarId: string }> {
  const cfg = googleConfig();
  if (!cfg) throw new MeetingError("Google isn't configured on the server (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).");
  const conn = await getConnection();
  if (!conn) throw new MeetingError("Google isn't connected yet. An admin can connect it on the Meetings page.");
  if (conn.status === "NEEDS_RECONNECT") {
    throw new MeetingError("Google access expired or was revoked. An admin needs to reconnect Google on the Meetings page.");
  }

  const cached = g.__iflowGoogleToken;
  if (cached && cached.key === conn.refreshTokenEnc && cached.exp > Date.now() + 60_000) {
    return { token: cached.token, calendarId: conn.calendarId };
  }

  const refresh = decryptValue(conn.refreshTokenEnc);
  if (!refresh || refresh.includes("DECRYPTION_FAILED")) {
    await prisma.googleConnection.update({ where: { id: "workspace" }, data: { status: "NEEDS_RECONNECT", lastError: "Stored credentials could not be decrypted (check ENCRYPTION_KEY)." } });
    throw new MeetingError("Stored Google credentials could not be read. An admin needs to reconnect Google.");
  }

  try {
    const tr = await refreshAccessToken(cfg, refresh);
    g.__iflowGoogleToken = { key: conn.refreshTokenEnc, token: tr.access_token, exp: Date.now() + tr.expires_in * 1000 };
    return { token: tr.access_token, calendarId: conn.calendarId };
  } catch (e) {
    if (e instanceof GoogleApiError && e.kind === "AUTH") {
      await prisma.googleConnection.update({ where: { id: "workspace" }, data: { status: "NEEDS_RECONNECT", lastError: e.message } });
    }
    throw new MeetingError(friendlyGoogleError(e));
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function loadMeeting(id: string) {
  return prisma.meeting.findUnique({ where: { id }, include: { attendees: true, exceptions: true } });
}

export function toEventInput(m: MeetingWithPeople): EventInput {
  return {
    meetingId: m.id,
    title: m.title,
    description: m.description,
    startLocal: m.startLocal,
    timezone: m.timezone,
    durationMin: m.durationMin,
    rrule: m.kind === "RECURRING" ? m.rrule : null,
    attendees: m.attendees.map((a) => ({ email: a.email, displayName: a.displayName, optional: a.optional })),
    guestsCanModify: m.guestsCanModify,
    guestsCanInvite: m.guestsCanInvite,
    guestsCanSeeOthers: m.guestsCanSeeOthers,
    reminderMinutes: m.reminderMinutes,
  };
}

const sendUpdatesFor = (m: { sendInvites: boolean }): SendUpdates => (m.sendInvites ? "all" : "none");

async function markFailed(id: string, e: unknown): Promise<{ ok: false; error: string }> {
  const error = friendlyGoogleError(e);
  await prisma.meeting.update({ where: { id }, data: { syncStatus: "FAILED", lastError: error } }).catch(() => undefined);
  return { ok: false, error };
}

/** Google creates the Meet link asynchronously — poll briefly until it is attached. */
async function waitForMeetUrl(token: string, calendarId: string, eventId: string, first: GoogleEvent): Promise<string | null> {
  let url = extractMeetUrl(first);
  for (let i = 0; !url && i < 4; i++) {
    await sleep(700);
    url = extractMeetUrl(await getEvent(token, calendarId, eventId));
  }
  return url;
}

// ── create / update ─────────────────────────────────────────────────────────

/** Creates the event on first call, patches it afterwards. Safe to retry (deterministic event id). */
export async function pushMeeting(meetingId: string): Promise<SyncResult> {
  const m = await loadMeeting(meetingId);
  if (!m) return { ok: false, error: "Meeting not found" };

  try {
    const { token, calendarId: currentCal } = await getAccessToken();
    const calendarId = calFor(m, currentCal);
    const input = toEventInput(m);
    const updates = sendUpdatesFor(m);
    let event: GoogleEvent;
    let eventId = m.googleEventId;

    if (!eventId) {
      try {
        event = await insertEvent(
          token,
          calendarId,
          buildEventResource(input, { includeId: true, conferenceRequestId: m.addMeet ? `iflow-${m.id}` : undefined }),
          updates
        );
        eventId = event.id;
      } catch (e) {
        // A previous attempt created it but we never saved the result → adopt it and reconcile.
        if (e instanceof GoogleApiError && e.kind === "CONFLICT") {
          eventId = googleEventIdFor(m.id);
          event = await patchEvent(token, calendarId, eventId, buildEventResource(input, { conferenceRequestId: m.addMeet && !m.meetUrl ? `iflow-${m.id}-r` : undefined }), updates);
        } else {
          throw e;
        }
      }
    } else {
      event = await patchEvent(
        token,
        calendarId,
        eventId,
        buildEventResource(input, { conferenceRequestId: m.addMeet && !m.meetUrl ? `iflow-${m.id}-${Date.now()}` : undefined }),
        updates
      );
    }

    const meetUrl = m.addMeet ? await waitForMeetUrl(token, calendarId, eventId!, event) : (m.meetUrl ?? extractMeetUrl(event));
    await prisma.meeting.update({
      where: { id: m.id },
      data: {
        googleEventId: eventId,
        calendarId,
        meetUrl: meetUrl ?? m.meetUrl,
        htmlLink: event.htmlLink ?? m.htmlLink,
        syncStatus: "SYNCED",
        lastError: m.addMeet && !meetUrl ? "Event saved, but Google hasn't attached a Meet link yet — use Refresh in a moment." : null,
        lastSyncedAt: new Date(),
      },
    });
    return { ok: true, meetUrl: meetUrl ?? null };
  } catch (e) {
    return markFailed(m.id, e);
  }
}

// ── cancel ──────────────────────────────────────────────────────────────────

export async function cancelMeetingOnGoogle(meetingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await loadMeeting(meetingId);
  if (!m) return { ok: false, error: "Meeting not found" };
  try {
    if (m.googleEventId) {
      const { token, calendarId: currentCal } = await getAccessToken();
      await deleteEvent(token, calFor(m, currentCal), m.googleEventId, sendUpdatesFor(m));
    }
    await prisma.meeting.update({
      where: { id: m.id },
      data: { status: "CANCELLED", syncStatus: "SYNCED", lastError: null, lastSyncedAt: new Date() },
    });
    return { ok: true };
  } catch (e) {
    return markFailed(m.id, e);
  }
}

// ── single occurrence ───────────────────────────────────────────────────────

async function findInstance(token: string, calendarId: string, m: MeetingWithPeople, originalStartLocal: string): Promise<GoogleEvent> {
  if (!m.googleEventId) throw new MeetingError("This meeting hasn't been saved to Google yet — retry the sync first.");
  const target = zonedToUtc(originalStartLocal, m.timezone).getTime();
  const items = await listInstances(token, calendarId, m.googleEventId, new Date(target - 12 * 3600_000), new Date(target + 12 * 3600_000));
  const hit = items.find((i) => i.originalStartTime?.dateTime && new Date(i.originalStartTime.dateTime).getTime() === target);
  if (!hit) throw new MeetingError("That occurrence no longer exists in Google Calendar.");
  return hit;
}

export async function cancelOccurrenceOnGoogle(meetingId: string, originalStartLocal: string) {
  const m = await loadMeeting(meetingId);
  if (!m) return { ok: false as const, error: "Meeting not found" };
  try {
    const { token, calendarId: currentCal } = await getAccessToken();
    const calendarId = calFor(m, currentCal);
    const inst = await findInstance(token, calendarId, m, originalStartLocal);
    await patchEvent(token, calendarId, inst.id, { status: "cancelled" }, sendUpdatesFor(m));
    await prisma.meetingException.upsert({
      where: { meetingId_originalStartLocal: { meetingId, originalStartLocal } },
      create: { meetingId, originalStartLocal, type: "CANCELLED", googleInstanceId: inst.id },
      update: { type: "CANCELLED", newStartLocal: null, newDurationMin: null, googleInstanceId: inst.id },
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof MeetingError ? e.message : friendlyGoogleError(e) };
  }
}

export async function rescheduleOccurrenceOnGoogle(meetingId: string, originalStartLocal: string, newStartLocal: string, newDurationMin: number) {
  const m = await loadMeeting(meetingId);
  if (!m) return { ok: false as const, error: "Meeting not found" };
  try {
    const { token, calendarId: currentCal } = await getAccessToken();
    const calendarId = calFor(m, currentCal);
    const inst = await findInstance(token, calendarId, m, originalStartLocal);
    await patchEvent(
      token,
      calendarId,
      inst.id,
      buildInstancePatch({ startLocal: newStartLocal, timezone: m.timezone, durationMin: newDurationMin }),
      sendUpdatesFor(m)
    );
    await prisma.meetingException.upsert({
      where: { meetingId_originalStartLocal: { meetingId, originalStartLocal } },
      create: { meetingId, originalStartLocal, type: "MODIFIED", newStartLocal, newDurationMin, googleInstanceId: inst.id },
      update: { type: "MODIFIED", newStartLocal, newDurationMin, googleInstanceId: inst.id },
    });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof MeetingError ? e.message : friendlyGoogleError(e) };
  }
}

// ── pull changes made directly in Google Calendar ───────────────────────────

export async function pullFromGoogle(meetingId: string): Promise<{ ok: true; changed: boolean } | { ok: false; error: string }> {
  const m = await loadMeeting(meetingId);
  if (!m) return { ok: false, error: "Meeting not found" };
  if (!m.googleEventId) return { ok: false, error: "This meeting isn't on Google Calendar yet." };
  try {
    const { token, calendarId: currentCal } = await getAccessToken();
    const calendarId = calFor(m, currentCal);
    let ev: GoogleEvent;
    try {
      ev = await getEvent(token, calendarId, m.googleEventId);
    } catch (e) {
      if (e instanceof GoogleApiError && e.kind === "NOT_FOUND") {
        await prisma.meeting.update({ where: { id: m.id }, data: { status: "CANCELLED", syncStatus: "SYNCED", lastError: "Deleted in Google Calendar", lastSyncedAt: new Date() } });
        return { ok: true, changed: true };
      }
      throw e;
    }

    if (ev.status === "cancelled") {
      await prisma.meeting.update({ where: { id: m.id }, data: { status: "CANCELLED", syncStatus: "SYNCED", lastError: "Cancelled in Google Calendar", lastSyncedAt: new Date() } });
      return { ok: true, changed: true };
    }

    const data: Record<string, unknown> = { lastSyncedAt: new Date(), syncStatus: "SYNCED", lastError: null };
    let changed = false;
    const url = extractMeetUrl(ev);
    if (url && url !== m.meetUrl) (data.meetUrl = url), (changed = true);
    if (ev.htmlLink && ev.htmlLink !== m.htmlLink) data.htmlLink = ev.htmlLink;
    if (ev.summary && ev.summary !== m.title) (data.title = ev.summary), (changed = true);

    if (ev.start?.dateTime && ev.end?.dateTime) {
      const tz = ev.start.timeZone || m.timezone;
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      const startLocal = utcToZoned(s, tz);
      const durationMin = Math.max(5, Math.round((e.getTime() - s.getTime()) / 60_000));
      if (startLocal !== m.startLocal || tz !== m.timezone || durationMin !== m.durationMin) {
        Object.assign(data, { startLocal, timezone: tz, durationMin, startUtc: s });
        changed = true;
      }
    }
    await prisma.meeting.update({ where: { id: m.id }, data });
    return { ok: true, changed };
  } catch (e) {
    return { ok: false, error: e instanceof MeetingError ? e.message : friendlyGoogleError(e) };
  }
}
