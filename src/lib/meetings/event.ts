/**
 * Meetings — pure mapping from an IFlow meeting to a Google Calendar event resource.
 * No I/O here, so the exact payload we send is unit-tested.
 */

import { endLocal } from "./time";

export interface EventAttendee {
  email: string;
  displayName?: string | null;
  optional: boolean;
}

export interface EventInput {
  meetingId: string;
  title: string;
  description?: string | null;
  startLocal: string;
  timezone: string;
  durationMin: number;
  /** "RRULE:FREQ=…" for a recurring series; omitted for one-time meetings. */
  rrule?: string | null;
  attendees: EventAttendee[];
  guestsCanModify: boolean;
  guestsCanInvite: boolean;
  guestsCanSeeOthers: boolean;
  /** null = the calendar's default reminders. */
  reminderMinutes: number | null;
}

const FOOTER = "—\nScheduled with IFlow";

/**
 * Deterministic Google event id for a meeting. Google ids must be base32hex
 * (a-v, 0-9) and 5–1024 chars, so we hex-encode the meeting id. Creating an event
 * with an id we already used returns 409 instead of a duplicate → safe retries.
 */
export function googleEventIdFor(meetingId: string): string {
  return "m" + Buffer.from(meetingId, "utf8").toString("hex");
}

export function buildDescription(description?: string | null): string {
  const body = (description ?? "").trim();
  return body ? `${body}\n\n${FOOTER}` : FOOTER;
}

export interface BuildOptions {
  /** Include the deterministic id (create only). */
  includeId?: boolean;
  /** Ask Google to attach a new Meet link (create, or when turning Meet on). */
  conferenceRequestId?: string;
}

export function buildEventResource(input: EventInput, options: BuildOptions = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.title.trim(),
    description: buildDescription(input.description),
    start: { dateTime: `${input.startLocal}:00`, timeZone: input.timezone },
    end: { dateTime: `${endLocal(input.startLocal, input.timezone, input.durationMin)}:00`, timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({
      email: a.email.trim().toLowerCase(),
      ...(a.displayName ? { displayName: a.displayName } : {}),
      ...(a.optional ? { optional: true } : {}),
    })),
    guestsCanModify: input.guestsCanModify,
    guestsCanInviteOthers: input.guestsCanInvite,
    guestsCanSeeOtherGuests: input.guestsCanSeeOthers,
    reminders:
      input.reminderMinutes === null
        ? { useDefault: true }
        : { useDefault: false, overrides: [{ method: "popup", minutes: input.reminderMinutes }] },
    extendedProperties: { private: { iflowMeetingId: input.meetingId } },
  };
  if (input.rrule) body.recurrence = [input.rrule];
  if (options.includeId) body.id = googleEventIdFor(input.meetingId);
  if (options.conferenceRequestId) {
    body.conferenceData = {
      createRequest: {
        requestId: options.conferenceRequestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

/** Payload to move/resize/rename ONE occurrence of a series. */
export function buildInstancePatch(p: {
  startLocal: string;
  timezone: string;
  durationMin: number;
  title?: string;
}): Record<string, unknown> {
  return {
    ...(p.title ? { summary: p.title.trim() } : {}),
    start: { dateTime: `${p.startLocal}:00`, timeZone: p.timezone },
    end: { dateTime: `${endLocal(p.startLocal, p.timezone, p.durationMin)}:00`, timeZone: p.timezone },
  };
}

/** Pull the Meet join link out of a Google event. */
export function extractMeetUrl(event: {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
}): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return video?.uri ?? null;
}
