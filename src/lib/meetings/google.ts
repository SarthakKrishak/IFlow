/**
 * Minimal Google OAuth + Calendar v3 client (fetch only — no SDK dependency).
 *
 * Hardening: request timeouts, bounded retries with exponential backoff + jitter on
 * 429/5xx/rate-limit 403s, typed errors, and 404/410-tolerant deletes.
 */

/** Optional: without it everything works except the attendance view. */
export const MEET_ATTENDANCE_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  // Create / edit / delete events (and their Meet links) on calendars the user can write to.
  "https://www.googleapis.com/auth/calendar.events",
  // List calendars so an admin can pick the team calendar.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  // Read Meet conference records (who joined, when) for calls this account organises.
  MEET_ATTENDANCE_SCOPE,
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Must match an "Authorized redirect URI" in the Google Cloud OAuth client exactly. */
export function redirectUri(requestOrigin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI.trim();
  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || requestOrigin || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/google/callback`;
}

export type GoogleErrorKind = "AUTH" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT" | "INVALID" | "UNAVAILABLE" | "UNKNOWN";

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: GoogleErrorKind,
    public readonly reason?: string
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

function classify(status: number, reason?: string): GoogleErrorKind {
  if (status === 401 || reason === "invalid_grant" || reason === "authError") return "AUTH";
  if (status === 403 && (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason === "quotaExceeded")) return "RATE_LIMIT";
  if (status === 403) return "FORBIDDEN";
  if (status === 404 || status === 410) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMIT";
  if (status === 400 || status === 422) return "INVALID";
  if (status >= 500) return "UNAVAILABLE";
  return "UNKNOWN";
}

/** A short message that is safe to show to the person scheduling. */
export function friendlyGoogleError(e: unknown): string {
  if (e instanceof GoogleApiError) {
    switch (e.kind) {
      case "AUTH":
        return "Google access expired or was revoked. An admin needs to reconnect Google on the Meetings page.";
      case "FORBIDDEN":
        return "The connected Google account can't edit this calendar. Pick a calendar it has write access to.";
      case "NOT_FOUND":
        return "Google couldn't find that calendar or event — it may have been deleted in Google Calendar.";
      case "RATE_LIMIT":
        return "Google is rate-limiting requests right now. Wait a minute and retry.";
      case "UNAVAILABLE":
        return "Google Calendar is temporarily unavailable. Retry in a moment.";
      case "INVALID":
        return `Google rejected the request: ${e.message}`;
      default:
        return e.message || "Unexpected Google error.";
    }
  }
  return e instanceof Error ? e.message : "Unexpected error talking to Google.";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 3;

async function request<T>(url: string, init: RequestInit & { token: string }, attempt = 0): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(rest.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
      return request<T>(url, init, attempt + 1);
    }
    throw new GoogleApiError(e instanceof Error ? e.message : "Network error", 0, "UNAVAILABLE");
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  let message = res.statusText;
  let reason: string | undefined;
  try {
    const data = await res.json();
    message = data?.error?.message ?? message;
    reason = data?.error?.errors?.[0]?.reason ?? data?.error?.status;
  } catch {
    /* non-JSON error body */
  }
  const kind = classify(res.status, reason);
  if ((kind === "RATE_LIMIT" || kind === "UNAVAILABLE") && attempt < MAX_RETRIES) {
    await sleep(500 * 2 ** attempt + Math.random() * 300);
    return request<T>(url, init, attempt + 1);
  }
  throw new GoogleApiError(message, res.status, kind, reason);
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export function buildAuthUrl(cfg: GoogleConfig, redirect: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // we need a refresh token…
    prompt: "consent", // …and Google only returns one when consent is shown
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error as string | undefined;
    throw new GoogleApiError(data?.error_description ?? code ?? "Token request failed", res.status, code === "invalid_grant" ? "AUTH" : classify(res.status, code), code);
  }
  return data as TokenResponse;
}

export function exchangeCode(cfg: GoogleConfig, code: string, redirect: string): Promise<TokenResponse> {
  return tokenRequest({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirect, grant_type: "authorization_code" });
}

export function refreshAccessToken(cfg: GoogleConfig, refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" });
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* best effort — the local connection is removed regardless */
  }
}

/** Email claim of an ID token received directly from Google's token endpoint over TLS. */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ── Calendar ────────────────────────────────────────────────────────────────

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
}

export type SendUpdates = "all" | "none";

export interface GoogleEvent {
  id: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  summary?: string;
  recurringEventId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  originalStartTime?: { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean; resource?: boolean }[];
  eventType?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[]; createRequest?: { status?: { statusCode?: string } } };
}

const cal = (id: string) => encodeURIComponent(id);

export async function listCalendars(token: string): Promise<GoogleCalendarEntry[]> {
  const data = await request<{ items?: GoogleCalendarEntry[] }>(`${API}/users/me/calendarList?minAccessRole=writer&maxResults=250`, { token });
  return data.items ?? [];
}

export function insertEvent(token: string, calendarId: string, body: Record<string, unknown>, sendUpdates: SendUpdates) {
  return request<GoogleEvent>(`${API}/calendars/${cal(calendarId)}/events?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, {
    token,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getEvent(token: string, calendarId: string, eventId: string) {
  return request<GoogleEvent>(`${API}/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, { token });
}

export function patchEvent(token: string, calendarId: string, eventId: string, body: Record<string, unknown>, sendUpdates: SendUpdates) {
  return request<GoogleEvent>(
    `${API}/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=${sendUpdates}`,
    { token, method: "PATCH", body: JSON.stringify(body) }
  );
}

/** Deleting something already gone (404/410) counts as success. */
export async function deleteEvent(token: string, calendarId: string, eventId: string, sendUpdates: SendUpdates): Promise<void> {
  try {
    await request<void>(`${API}/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`, { token, method: "DELETE" });
  } catch (e) {
    if (e instanceof GoogleApiError && e.kind === "NOT_FOUND") return;
    throw e;
  }
}

/** Instances of a recurring event between two instants (used to address ONE occurrence). */
export async function listInstances(token: string, calendarId: string, eventId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
  const q = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    showDeleted: "false",
    maxResults: "50",
  });
  const data = await request<{ items?: GoogleEvent[] }>(`${API}/calendars/${cal(calendarId)}/events/${encodeURIComponent(eventId)}/instances?${q}`, { token });
  return data.items ?? [];
}

/**
 * Every event (recurring ones expanded to single instances) in a time window,
 * INCLUDING cancelled ones, so deletions made in Google can be mirrored.
 */
export async function listEvents(token: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 6; page++) {
    const q = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const data = await request<{ items?: GoogleEvent[]; nextPageToken?: string }>(`${API}/calendars/${cal(calendarId)}/events?${q}`, { token });
    out.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

// ── Meet (attendance) ───────────────────────────────────────────────────────

const MEET_API = "https://meet.googleapis.com/v2";

export interface ConferenceRecord {
  name: string; // "conferenceRecords/{id}"
  startTime: string;
  endTime?: string;
}

export interface MeetParticipant {
  name: string;
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: { user?: string; displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
}

/** "https://meet.google.com/abc-defg-hij" → "abc-defg-hij" */
export function meetingCodeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/meet\.google\.com\/([a-z]{3,4}-[a-z]{4}-[a-z]{3,4})/i);
  return m ? m[1].toLowerCase() : null;
}

/** Past (and in-progress) calls held in the Meet space with this code, newest first. Kept by Google for 30 days. */
export async function listConferenceRecords(token: string, meetingCode: string): Promise<ConferenceRecord[]> {
  const q = new URLSearchParams({ filter: `space.meeting_code = "${meetingCode}"`, pageSize: "25" });
  const data = await request<{ conferenceRecords?: ConferenceRecord[] }>(`${MEET_API}/conferenceRecords?${q}`, { token });
  return (data.conferenceRecords ?? []).sort((a, b) => b.startTime.localeCompare(a.startTime));
}

export async function listParticipants(token: string, recordName: string): Promise<MeetParticipant[]> {
  const out: MeetParticipant[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ pageSize: "100" });
    if (pageToken) q.set("pageToken", pageToken);
    const data = await request<{ participants?: MeetParticipant[]; nextPageToken?: string }>(`${MEET_API}/${recordName}/participants?${q}`, { token });
    out.push(...(data.participants ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}
