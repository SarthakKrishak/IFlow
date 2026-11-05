"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  Check,
  ClipboardCopy,
  ExternalLink,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShieldCheck,
  Unplug,
  Video,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Segmented, SectionLabel, Select, buttonStyles, useConfirm } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConnectionInfo, MeetingRow, MemberRow } from "@/lib/meetings/queries";
import {
  cancelMeeting,
  cancelOccurrence,
  disconnectGoogle,
  listGoogleCalendars,
  refreshMeeting,
  rescheduleOccurrence,
  retrySync,
  setGoogleCalendar,
} from "@/server/actions/meeting.actions";
import { dateOnly, formatInZone } from "@/lib/meetings/time";
import { MeetingForm } from "./MeetingForm";
import { browserTimeZone, dayHeading, dayKey, scheduleSummary, timeRange, upcomingOccurrences, viewerNote, type Occurrence } from "./helpers";

interface Props {
  meetings: MeetingRow[];
  members: MemberRow[];
  connection: ConnectionInfo;
  viewer: { id: string; role: "ADMIN" | "MANAGER" | "MEMBER" };
  flash: { connected: boolean; error: string | null };
  focusMeetingId: string | null;
}

const FLASH_ERRORS: Record<string, string> = {
  admin_only: "Only an admin can connect Google.",
  not_configured: "Google isn’t configured on the server yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  denied: "Google sign-in was cancelled.",
  bad_state: "The sign-in request expired or didn’t match. Please try connecting again.",
  no_code: "Google didn’t return an authorization code. Please try again.",
  missing_scope: "Calendar permission wasn’t granted. Tick the calendar checkbox on Google’s consent screen and try again.",
  no_email: "Couldn’t read the Google account email. Please try again.",
  no_refresh_token: "Google didn’t issue a long-lived token. Remove IFlow at myaccount.google.com/permissions, then connect again.",
};

type Tab = "upcoming" | "all" | "google";

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

function KebabMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const shown = items.filter((i) => !i.hidden);
  if (shown.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full mt-1 w-56 bg-popover rounded-lg shadow-pop z-50 p-1 animate-in fade-in zoom-in-95 duration-150">
            {shown.map((i) => (
              <button
                key={i.label}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  i.onClick();
                }}
                className={cn("w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium text-left transition-colors", i.danger ? "text-red-500 hover:bg-red-500/10" : "text-foreground hover:bg-surface-hover")}
              >
                <span className={i.danger ? "" : "text-muted-foreground"}>{i.icon}</span>
                {i.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The next (or live) meeting, with the one action that matters: join. */
function NextUp({
  occurrences,
  now,
  viewerTz,
  members,
  statusOf,
  onCopy,
}: {
  occurrences: Occurrence[];
  now: Date | null;
  viewerTz: string;
  members: MemberRow[];
  statusOf: (o: Occurrence) => { label: string; tone: "success" | "warning" } | null;
  onCopy: (url: string) => void;
}) {
  const next = now ? occurrences.find((o) => o.end >= now && o.meeting.status === "ACTIVE") : undefined;
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-foreground mb-3">Next up</h3>
      {!next || !now ? (
        <p className="text-[13px] text-muted-foreground">Nothing scheduled.</p>
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 shadow-card">
          {(() => {
            const st = statusOf(next);
            const live = st?.tone === "success";
            const startsIn = live ? "Live now" : `Starts ${formatDistanceToNowStrict(next.start, { addSuffix: true })}`;
            return (
              <>
                <p className={cn("text-[12px] font-medium", live ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 -translate-y-px" />}
                  {startsIn}
                </p>
                <p className="text-[16px] font-semibold text-foreground mt-1.5 leading-snug">{next.meeting.title}</p>
                <p className="text-[12.5px] text-muted-foreground mt-1">
                  {formatInZone(next.start, viewerTz, { weekday: "short", month: "short", day: "numeric" })} · {timeRange(next.start, next.end, viewerTz)}
                </p>
                <div className="mt-3">
                  <AvatarPile meeting={next.meeting} members={members} />
                </div>
                {next.meeting.meetUrl && (
                  <div className="flex items-center gap-2 mt-4">
                    <a href={next.meeting.meetUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles(live ? "primary" : "secondary", "md", "flex-1")}>
                      <Video size={14} /> Join Google Meet
                    </a>
                    <button onClick={() => onCopy(next.meeting.meetUrl!)} className={buttonStyles("ghost", "md", "!w-8 !px-0")} aria-label="Copy Meet link" title="Copy Meet link">
                      <ClipboardCopy size={14} />
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/** Seven-day load at a glance: one bar per day, height = number of meetings. */
function WeekStrip({ occurrences, now, viewerTz }: { occurrences: Occurrence[]; now: Date; viewerTz: string }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() + i * 86400000));
  const counts = days.map((d) => occurrences.filter((o) => dayKey(o.start, viewerTz) === dayKey(d, viewerTz)).length);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-foreground mb-3">
        Next 7 days <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{total} meeting{total === 1 ? "" : "s"}</span>
      </h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5" title={`${counts[i]} meeting${counts[i] === 1 ? "" : "s"}`}>
            <div className="h-12 w-full rounded-md bg-foreground/[0.05] flex items-end overflow-hidden">
              <div className={cn("w-full rounded-md", i === 0 ? "bg-primary" : "bg-foreground/40")} style={{ height: `${counts[i] ? Math.max(12, (counts[i] / max) * 100) : 0}%` }} />
            </div>
            <span className={cn("text-[11px]", i === 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {formatInZone(d, viewerTz, { weekday: "narrow" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvatarPile({ meeting, members }: { meeting: MeetingRow; members: MemberRow[] }) {
  const people = meeting.attendees.map((a) => {
    const m = a.userId ? members.find((x) => x.id === a.userId) : null;
    return { key: a.id, name: m?.displayName ?? a.displayName ?? a.email, color: m?.avatarColor ?? "#64748b" };
  });
  if (people.length === 0) return <span className="text-[12px] text-muted-foreground">Just you</span>;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {people.slice(0, 5).map((p) => (
          <span key={p.key} title={p.name} className="w-6 h-6 rounded-full ring-2 ring-surface-elevated flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: p.color }}>
            {p.name.charAt(0).toUpperCase()}
          </span>
        ))}
      </div>
      <span className="ml-2 text-[12px] text-muted-foreground tabular-nums">{people.length}</span>
    </div>
  );
}

export function MeetingsClient({ meetings, members, connection, viewer, flash, focusMeetingId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const { confirm: ask, dialog: confirmDialog } = useConfirm();

  const isAdmin = viewer.role === "ADMIN";
  const connected = connection.connected && connection.status === "ACTIVE";
  // Every team member schedules once Google is connected; only admins manage the connection.
  const canSchedule = connected;

  const [tab, setTab] = useState<Tab>(focusMeetingId ? "all" : "upcoming");
  const [formFor, setFormFor] = useState<MeetingRow | "new" | null>(null);
  const [occurrenceEdit, setOccurrenceEdit] = useState<Occurrence | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // `now` and the viewer's zone only exist in the browser → set after mount (avoids hydration mismatch).
  const [now, setNow] = useState<Date | null>(null);
  const [viewerTz, setViewerTz] = useState("UTC");
  useEffect(() => {
    setNow(new Date());
    setViewerTz(browserTimeZone());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // One-time toast for the OAuth round-trip, then clean the URL.
  useEffect(() => {
    if (flash.connected) toast.success("Google connected", { description: "You can now schedule meetings from IFlow." });
    if (flash.error) toast.error(FLASH_ERRORS[flash.error] ?? decodeURIComponent(flash.error));
    if (flash.connected || flash.error) router.replace("/meetings", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const occurrences = useMemo(() => (now ? upcomingOccurrences(meetings, now, 30) : []), [meetings, now]);
  const nextByMeeting = useMemo(() => {
    if (!now) return new Map<string, Occurrence>();
    const map = new Map<string, Occurrence>();
    for (const o of upcomingOccurrences(meetings, now, 365)) if (!map.has(o.meeting.id)) map.set(o.meeting.id, o);
    return map;
  }, [meetings, now]);

  const [filter, setFilter] = useState<"active" | "cancelled" | "all">("active");
  const [query, setQuery] = useState("");
  const listed = meetings.filter(
    (m) =>
      (filter === "all" || (filter === "active" ? m.status === "ACTIVE" : m.status === "CANCELLED")) &&
      m.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  const failedCount = meetings.filter((m) => m.status === "ACTIVE" && m.syncStatus === "FAILED").length;

  // ── actions ──
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meet link copied");
    } catch {
      toast.error("Couldn’t copy — your browser blocked clipboard access");
    }
  };

  const doRetry = async (m: MeetingRow) => {
    setBusy(m.id);
    const res = await retrySync({ meetingId: m.id });
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    if (res.data.synced) toast.success("Synced with Google Calendar");
    else toast.error(res.data.syncError ?? "Still couldn’t sync");
    refresh();
  };

  const doRefresh = async (m: MeetingRow) => {
    setBusy(m.id);
    const res = await refreshMeeting({ meetingId: m.id });
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success(res.data.changed ? "Updated from Google Calendar" : "Already up to date");
    refresh();
  };

  const doCancelMeeting = async (m: MeetingRow) => {
    const series = m.kind === "RECURRING";
    if (
      !(await ask({
        title: series ? `Cancel the whole “${m.title}” series?` : `Cancel “${m.title}”?`,
        description: "It’s removed from Google Calendar and everyone invited is notified.",
        confirmLabel: series ? "Cancel series" : "Cancel meeting",
        danger: true,
      }))
    )
      return;
    setBusy(m.id);
    const res = await cancelMeeting({ meetingId: m.id });
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Meeting cancelled");
    refresh();
  };

  const doCancelOccurrence = async (o: Occurrence) => {
    if (
      !(await ask({
        title: "Cancel just this occurrence?",
        description: `${formatInZone(o.start, o.meeting.timezone, { weekday: "long", month: "long", day: "numeric" })} will be removed. The rest of the series stays.`,
        confirmLabel: "Cancel occurrence",
        danger: true,
      }))
    )
      return;
    setBusy(o.key);
    const res = await cancelOccurrence({ meetingId: o.meeting.id, originalStartLocal: o.originalStartLocal });
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Occurrence cancelled");
    refresh();
  };

  const menuFor = (m: MeetingRow, o?: Occurrence): MenuItem[] => [
    { label: "Edit meeting", icon: <Pencil size={14} />, onClick: () => setFormFor(m), hidden: !canSchedule || m.status !== "ACTIVE" },
    { label: "Edit this occurrence", icon: <CalendarClock size={14} />, onClick: () => o && setOccurrenceEdit(o), hidden: !canSchedule || !o || m.kind !== "RECURRING" },
    { label: "Copy Meet link", icon: <ClipboardCopy size={14} />, onClick: () => m.meetUrl && copyLink(m.meetUrl), hidden: !m.meetUrl },
    { label: "Open in Google Calendar", icon: <ExternalLink size={14} />, onClick: () => m.htmlLink && window.open(m.htmlLink, "_blank", "noopener,noreferrer"), hidden: !m.htmlLink },
    { label: "Refresh from Google", icon: <RefreshCw size={14} />, onClick: () => doRefresh(m), hidden: !m.googleEventId || m.status !== "ACTIVE" },
    { label: "Cancel this occurrence", icon: <XCircle size={14} />, onClick: () => o && doCancelOccurrence(o), danger: true, hidden: !canSchedule || !o || m.kind !== "RECURRING" },
    { label: m.kind === "RECURRING" ? "Cancel entire series" : "Cancel meeting", icon: <CalendarX2 size={14} />, onClick: () => doCancelMeeting(m), danger: true, hidden: !canSchedule || m.status !== "ACTIVE" },
  ];

  // ── agenda grouping (in the viewer's zone) ──
  const days = useMemo(() => {
    const groups: { key: string; heading: string; items: Occurrence[] }[] = [];
    if (!now) return groups;
    for (const o of occurrences) {
      const key = dayKey(o.start, viewerTz);
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, heading: dayHeading(o.start, viewerTz, now), items: [] }));
      g.items.push(o);
    }
    return groups;
  }, [occurrences, viewerTz, now]);

  const statusOf = (o: Occurrence) => {
    if (!now) return null;
    if (o.start <= now && o.end >= now) return { label: "Live now", tone: "success" as const };
    const mins = (o.start.getTime() - now.getTime()) / 60_000;
    if (mins > 0 && mins <= 60) return { label: `In ${formatDistanceToNowStrict(o.start)}`, tone: "warning" as const };
    return null;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-6 max-w-[1320px] mx-auto space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Meetings</h2>
            <p className="text-[13px] text-muted-foreground mt-1">Google Meet calls for the team — scheduled once, kept in sync with Google Calendar.</p>
          </div>
          {(
            <Button variant="primary" disabled={!canSchedule} onClick={() => setFormFor("new")} title={!connected ? "Connect Google first" : undefined}>
              <Plus size={14} /> Schedule meeting
            </Button>
          )}
        </div>
        <nav className="mt-5 flex items-center gap-5 border-b border-surface-border" aria-label="Meetings views">
          {(
            [
              { value: "upcoming", label: "Upcoming", dot: null },
              { value: "all", label: "All meetings", dot: failedCount > 0 ? "bg-red-500" : null },
              { value: "google", label: "Google Calendar", dot: !connected ? "bg-amber-500" : null },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn(
                "h-10 -mb-px flex items-center gap-1.5 border-b-[1.5px] text-[13px] whitespace-nowrap transition-colors",
                tab === t.value ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.dot && <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} />}
            </button>
          ))}
        </nav>
      </div>

      {/* Connection banner */}
      {!connected && tab !== "google" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-2.5">
          <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          <p className="text-[13px] text-foreground flex-1 min-w-[220px]">
            {connection.status === "NEEDS_RECONNECT"
              ? "Google access expired or was revoked — meetings can’t be created or changed until it’s reconnected."
              : "Google Calendar isn’t connected yet. Connect your team’s account to start scheduling Meet calls from here."}
          </p>
          <Button size="sm" onClick={() => setTab("google")}>
            {isAdmin ? "Set up Google" : "See details"}
          </Button>
        </div>
      )}
      {failedCount > 0 && tab !== "all" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.04] px-4 py-2.5">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <p className="text-[13px] text-foreground flex-1">
            {failedCount} meeting{failedCount > 1 ? "s" : ""} couldn’t be saved to Google Calendar.
          </p>
          <Button size="sm" onClick={() => setTab("all")}>
            Review
          </Button>
        </div>
      )}

      {/* ── Upcoming ── */}
      {tab === "upcoming" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-x-12 gap-y-8">
          {/* Schedule */}
          <div className="min-w-0">
            {!now ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : days.length === 0 ? (
              <EmptyState
                icon={<CalendarClock size={22} />}
                title="No meetings in the next 30 days"
                description={canSchedule ? "Schedule a one-time call, or set up a recurring stand-up once and let Google run it." : connected ? "Nothing is scheduled yet." : "Once Google is connected, scheduled meetings show up here."}
                action={canSchedule ? <Button variant="primary" onClick={() => setFormFor("new")}><Plus size={14} /> Schedule meeting</Button> : undefined}
              />
            ) : (
              <ol className="divide-y divide-surface-border border-y border-surface-border">
                {days.map((day) => {
                  const first = day.items[0].start;
                  const isToday = now && dayKey(first, viewerTz) === dayKey(now, viewerTz);
                  return (
                    <li key={day.key} className="grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)] gap-3 sm:gap-4 py-4">
                      {/* Date gutter */}
                      <div className="leading-none pt-1">
                        <p className={cn("text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] tabular-nums", isToday ? "text-primary" : "text-foreground")}>
                          {formatInZone(first, viewerTz, { day: "numeric" })}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-1.5">{formatInZone(first, viewerTz, { weekday: "short", month: "short" })}</p>
                        {isToday && <p className="text-[11.5px] font-medium text-primary mt-1">Today</p>}
                      </div>

                      {/* That day's meetings */}
                      <ul className="space-y-1 min-w-0">
                        {day.items.map((o) => {
                          const st = statusOf(o);
                          const m = o.meeting;
                          const note = viewerNote(o.start, o.end, m.timezone, viewerTz);
                          const live = st?.tone === "success";
                          return (
                            <li
                              key={o.key}
                              className={cn(
                                "group relative flex items-center gap-x-3 sm:gap-x-4 rounded-lg px-2 sm:px-3 py-2.5 -mx-2 sm:-mx-3 transition-colors hover:bg-surface-hover/60",
                                live && "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]"
                              )}
                            >
                              <span className={cn("self-stretch w-[3px] rounded-full shrink-0", live ? "bg-emerald-500" : m.syncStatus === "FAILED" ? "bg-red-500/70" : "bg-primary/50")} aria-hidden="true" />
                              <div className="hidden sm:block w-[84px] shrink-0">
                                <p className="text-[13px] font-medium text-foreground tabular-nums">{formatInZone(o.start, viewerTz, { hour: "numeric", minute: "2-digit" })}</p>
                                <p className="text-[12px] text-muted-foreground tabular-nums">{o.durationMin} min</p>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[13.5px] font-medium text-foreground truncate max-w-full">{m.title}</p>
                                  {st && <Badge tone={st.tone} dot>{st.label}</Badge>}
                                  {o.moved && <Badge tone="info">Rescheduled</Badge>}
                                </div>
                                <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                                  <span className="sm:hidden text-foreground/80 tabular-nums">{formatInZone(o.start, viewerTz, { hour: "numeric", minute: "2-digit" })} · {o.durationMin}m · </span>
                                  {m.kind === "RECURRING" && (
                                    <>
                                      <Repeat size={11} className="inline -mt-0.5 mr-1" />
                                      {scheduleSummary(m)} ·{" "}
                                    </>
                                  )}
                                  {timeRange(o.start, o.end, m.timezone)}
                                  {note ? ` · ${note}` : ""}
                                </p>
                              </div>
                              <div className="hidden md:block shrink-0">
                                <AvatarPile meeting={m} members={members} />
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-auto">
                                {m.meetUrl ? (
                                  <a href={m.meetUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles(live ? "primary" : "secondary", "sm")}>
                                    <Video size={13} /> <span className="hidden sm:inline">Join</span>
                                  </a>
                                ) : m.syncStatus === "FAILED" ? (
                                  <Badge tone="danger">Not on Google</Badge>
                                ) : null}
                                <KebabMenu label={`Actions for ${m.title}`} items={menuFor(m, o)} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Rail */}
          <aside className="space-y-8 lg:border-l lg:border-surface-border lg:pl-10 min-w-0">
            <NextUp occurrences={occurrences} now={now} viewerTz={viewerTz} members={members} statusOf={statusOf} onCopy={copyLink} />
            {now && <WeekStrip occurrences={occurrences} now={now} viewerTz={viewerTz} />}
            <div>
              <h3 className="text-[13px] font-semibold text-foreground mb-2">Google Calendar</h3>
              <button onClick={() => setTab("google")} className="w-full text-left flex items-center gap-2.5 text-[12.5px] rounded-lg -mx-2 px-2 py-1.5 hover:bg-surface-hover/60 transition-colors">
                <span className={cn("w-2 h-2 rounded-full shrink-0", connected ? "bg-emerald-500" : "bg-amber-500")} />
                <span className="min-w-0">
                  <span className="block text-foreground truncate">{connected ? connection.calendarName ?? "Connected" : connection.status === "NEEDS_RECONNECT" ? "Needs reconnecting" : "Not connected"}</span>
                  {connected && connection.email && <span className="block text-muted-foreground truncate">{connection.email}</span>}
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── All meetings ── */}
      {tab === "all" && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-surface-border flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search meetings…" className="pl-8" aria-label="Search meetings" />
            </div>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "cancelled", label: "Cancelled" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          {listed.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<CalendarClock size={22} />} title="No meetings here" description={meetings.length === 0 ? "Meetings you schedule will be listed and managed here." : "Nothing matches this filter."} />
            </div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {listed.map((m) => {
                const next = nextByMeeting.get(m.id);
                const failed = m.syncStatus === "FAILED";
                return (
                  <li key={m.id} className={cn("px-4 py-3.5 flex flex-wrap lg:flex-nowrap items-center gap-x-5 gap-y-2 transition-colors", focusMeetingId === m.id && "bg-primary/[0.05]", m.status === "CANCELLED" && "opacity-60")}>
                    <div className="min-w-0 flex-1 basis-64">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13.5px] font-medium text-foreground truncate">{m.title}</p>
                        {m.kind === "RECURRING" ? <Badge><Repeat size={10} /> Series</Badge> : <Badge>One time</Badge>}
                        {m.status === "CANCELLED" && <Badge tone="danger">Cancelled</Badge>}
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {scheduleSummary(m)} · {m.startLocal.slice(11, 16)} · {m.timezone}
                      </p>
                      {(failed || m.lastError) && m.status === "ACTIVE" && (
                        <p className={cn("text-[12px] mt-1 flex items-start gap-1.5", failed ? "text-red-500" : "text-amber-600 dark:text-amber-400")}>
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {m.lastError ?? "Not saved to Google yet"}
                        </p>
                      )}
                    </div>

                    <div className="w-[180px] hidden sm:block">
                      <SectionLabel>Next</SectionLabel>
                      <p className="text-[12.5px] text-foreground mt-0.5">
                        {m.status === "CANCELLED" ? "—" : next ? formatInZone(next.start, viewerTz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : <span className="text-muted-foreground">Ended</span>}
                      </p>
                    </div>

                    <div className="hidden md:block w-[100px]">
                      <AvatarPile meeting={m} members={members} />
                    </div>

                    <div className="w-[110px]">
                      {m.status === "CANCELLED" ? null : m.syncStatus === "SYNCED" ? (
                        <Badge tone="success" dot>Synced</Badge>
                      ) : m.syncStatus === "PENDING" ? (
                        <Badge tone="info" dot>Syncing…</Badge>
                      ) : (
                        <Badge tone="danger" dot>Sync failed</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {failed && m.status === "ACTIVE" && (
                        <Button size="sm" loading={busy === m.id} onClick={() => doRetry(m)}>
                          {busy !== m.id && <RefreshCw size={13} />} Retry
                        </Button>
                      )}
                      {m.meetUrl && m.status === "ACTIVE" && (
                        <a href={m.meetUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles("secondary", "sm")}>
                          <Video size={14} /> Meet
                        </a>
                      )}
                      <KebabMenu label={`Actions for ${m.title}`} items={menuFor(m)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* ── Google ── */}
      {tab === "google" && <GooglePanel connection={connection} isAdmin={isAdmin} confirmAsk={ask} onChanged={refresh} />}

      {formFor && (
        <MeetingForm
          members={members}
          meeting={formFor === "new" ? null : formFor}
          viewerTz={viewerTz}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null);
            refresh();
          }}
        />
      )}
      {occurrenceEdit && (
        <OccurrenceDialog
          occurrence={occurrenceEdit}
          onClose={() => setOccurrenceEdit(null)}
          onSaved={() => {
            setOccurrenceEdit(null);
            refresh();
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

// ── Reschedule one occurrence ────────────────────────────────────────────────

function OccurrenceDialog({ occurrence, onClose, onSaved }: { occurrence: Occurrence; onClose: () => void; onSaved: () => void }) {
  const m = occurrence.meeting;
  const [date, setDate] = useState(dateOnly(occurrence.startLocal));
  const [time, setTime] = useState(occurrence.startLocal.slice(11, 16));
  const [duration, setDuration] = useState(occurrence.durationMin);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await rescheduleOccurrence({
      meetingId: m.id,
      originalStartLocal: occurrence.originalStartLocal,
      newStartLocal: `${date}T${time}`,
      newDurationMin: duration,
    });
    setSaving(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Occurrence rescheduled");
    onSaved();
  };

  return (
    <Dialog
      size="sm"
      title="Edit this occurrence"
      description={`Only ${formatInZone(occurrence.start, m.timezone, { weekday: "long", month: "long", day: "numeric" })} changes — the rest of “${m.title}” stays as is.`}
      onClose={() => !saving && onClose()}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!date || !time || duration < 5} onClick={save}>
            Save occurrence
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Start time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Duration (min)" className="col-span-2">
          <Input type="number" min={5} max={1440} step={5} value={duration} onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value || "0", 10)))} />
        </Field>
      </div>
      <p className="text-[12px] text-muted-foreground mt-3">Time zone: {m.timezone}</p>
    </Dialog>
  );
}

// ── Google connection ────────────────────────────────────────────────────────

function GooglePanel({
  connection,
  isAdmin,
  confirmAsk,
  onChanged,
}: {
  connection: ConnectionInfo;
  isAdmin: boolean;
  confirmAsk: (o: { title: string; description?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  onChanged: () => void;
}) {
  const [calendars, setCalendars] = useState<{ id: string; summary: string; primary: boolean }[] | null>(null);
  const [loadingCals, setLoadingCals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const needsReconnect = connection.connected && connection.status === "NEEDS_RECONNECT";

  const loadCalendars = async () => {
    setLoadingCals(true);
    const res = await listGoogleCalendars();
    setLoadingCals(false);
    if (!res.success) return toast.error(res.error);
    setCalendars(res.data);
  };

  const pickCalendar = async (id: string) => {
    const cal = calendars?.find((c) => c.id === id);
    if (!cal) return;
    setSaving(true);
    const res = await setGoogleCalendar({ calendarId: cal.id, calendarName: cal.summary });
    setSaving(false);
    if (!res.success) return toast.error(res.error);
    toast.success(`New meetings will be created on “${cal.summary}”`);
    onChanged();
  };

  const disconnect = async () => {
    if (!(await confirmAsk({ title: "Disconnect Google?", description: "IFlow stops creating and updating events. Meetings already on Google Calendar stay there.", confirmLabel: "Disconnect", danger: true }))) return;
    const res = await disconnectGoogle();
    if (!res.success) return toast.error(res.error);
    toast.success("Google disconnected");
    onChanged();
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Couldn’t copy");
    }
  };

  const CopyRow = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-base px-3 h-8">
      <code className="font-mono text-[12.5px] text-foreground truncate flex-1">{v}</code>
      <button onClick={() => copy(k, v)} className="text-muted-foreground hover:text-foreground" aria-label={`Copy ${k}`}>
        {copied === k ? <Check size={14} className="text-emerald-500" /> : <ClipboardCopy size={14} />}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <CardHeader
            title="Google Calendar"
            description="The team account meetings are created on"
            icon={<Link2 size={16} />}
            action={
              connection.connected ? (
                <Badge tone={needsReconnect ? "danger" : "success"} dot>{needsReconnect ? "Needs reconnect" : "Connected"}</Badge>
              ) : (
                <Badge tone="warning" dot>Not connected</Badge>
              )
            }
          />
          <div className="p-5 space-y-5">
            {!connection.configured ? (
              <div className="space-y-4">
                <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-foreground">Google isn’t set up on this server yet. This is a one-time task for whoever manages the deployment.</p>
                </div>
                <ol className="space-y-4 text-[13px] text-muted-foreground list-decimal pl-5 marker:font-semibold marker:text-foreground">
                  <li>
                    In <b className="text-foreground">Google Cloud Console</b>, create a project and enable the <b className="text-foreground">Google Calendar API</b>.
                  </li>
                  <li>
                    Under <b className="text-foreground">APIs &amp; Services → Credentials</b>, create an <b className="text-foreground">OAuth client ID</b> of type <b className="text-foreground">Web application</b>. Configure the consent screen (Internal is fine for a Workspace).
                  </li>
                  <li className="space-y-2">
                    Add this <b className="text-foreground">Authorized redirect URI</b>:
                    <CopyRow k="redirect" v={connection.redirectUri} />
                  </li>
                  <li className="space-y-2">
                    Set these environment variables, then restart the app:
                    <CopyRow k="env1" v="GOOGLE_CLIENT_ID=…" />
                    <CopyRow k="env2" v="GOOGLE_CLIENT_SECRET=…" />
                  </li>
                </ol>
              </div>
            ) : !connection.connected ? (
              <div className="space-y-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Connect the Google account whose calendar should own your team meetings. It will appear as the organizer, and IFlow will create events, Meet links and invites on its behalf.
                </p>
                {isAdmin ? (
                  <a href="/api/google/connect" className={buttonStyles("primary", "md")}>
                    <ShieldCheck size={15} /> Connect Google
                  </a>
                ) : (
                  <p className="text-[13px] text-foreground rounded-lg border border-surface-border px-3.5 py-3">Ask an admin to connect Google — only admins can do this.</p>
                )}
              </div>
            ) : (
              <>
                <dl className="divide-y divide-surface-border rounded-lg border border-surface-border text-[13px]">
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="font-medium text-foreground">{connection.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">Calendar</dt>
                    <dd className="font-medium text-foreground">{connection.calendarName ?? (connection.calendarId === "primary" ? "Primary calendar" : connection.calendarId)}</dd>
                  </div>
                </dl>
                {connection.lastError && needsReconnect && (
                  <p className="text-[12.5px] text-red-600 dark:text-red-400 rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3.5 py-2.5">{connection.lastError}</p>
                )}

                {isAdmin && (
                  <div className="space-y-4">
                    {!needsReconnect && (
                      <Field label="Create new meetings on" hint="Existing meetings stay on the calendar they were created on.">
                        {calendars ? (
                          <Select value={connection.calendarId ?? "primary"} onChange={(e) => pickCalendar(e.target.value)} disabled={saving} className="sm:!w-80">
                            {calendars.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.summary}
                                {c.primary ? " (primary)" : ""}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Button onClick={loadCalendars} loading={loadingCals}>
                            Choose a different calendar
                          </Button>
                        )}
                      </Field>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a href="/api/google/connect" className={buttonStyles(needsReconnect ? "primary" : "secondary", "md")}>
                        <RefreshCw size={14} /> {needsReconnect ? "Reconnect Google" : "Reconnect / switch account"}
                      </a>
                      <Button variant="danger" onClick={disconnect}>
                        <Unplug size={14} /> Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5 h-fit">
        <SectionLabel className="mb-3">How it works</SectionLabel>
        <ul className="space-y-3 text-[12.5px] text-muted-foreground leading-relaxed">
          <li><b className="text-foreground">Recurring meetings run on Google.</b> A series is one Google Calendar event with a repeat rule, so it keeps firing even if IFlow is down.</li>
          <li><b className="text-foreground">One Meet link per series.</b> Everyone uses the same link every time.</li>
          <li><b className="text-foreground">Edit anything later.</b> Change the whole series, one occurrence, or cancel just one date.</li>
          <li><b className="text-foreground">Times stay put.</b> A 10:00 meeting stays at 10:00 local time through daylight-saving changes.</li>
          <li><b className="text-foreground">Secure.</b> The token is encrypted at rest and never reaches the browser. IFlow only asks for calendar-events access.</li>
        </ul>
      </Card>
    </div>
  );
}
