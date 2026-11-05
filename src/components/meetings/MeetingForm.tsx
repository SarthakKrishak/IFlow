"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check, Clock, Globe2, Mail, Plus, Repeat, Search, Users, Video, X } from "lucide-react";
import { Badge, Button, Dialog, Field, Input, SectionLabel, Segmented, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createMeeting, saveMemberEmail, updateMeeting } from "@/server/actions/meeting.actions";
import { meetingInputSchema } from "@/lib/meetings/validators";
import {
  MAX_COUNT,
  MAX_INTERVAL,
  WEEKDAYS,
  WEEKDAY_LABEL,
  describeRecurrence,
  generateOccurrences,
  nthWeekdayOfStart,
  weekdayCode,
  type EndType,
  type Freq,
  type MonthlyMode,
  type RecurrenceRule,
  type Weekday,
} from "@/lib/meetings/recurrence";
import { dateOnly, formatInZone, isValidTimeZone, listTimeZones, zoneAbbr, zonedToUtc } from "@/lib/meetings/time";
import type { MeetingRow, MemberRow } from "@/lib/meetings/queries";
import { ruleFromRow, timeRange, viewerNote } from "./helpers";

interface Props {
  members: MemberRow[];
  meeting?: MeetingRow | null;
  viewerTz: string;
  onClose: () => void;
  onSaved: () => void;
}

interface Guest {
  email: string;
  optional: boolean;
}

const PRESETS: { id: string; label: string; hint: string; apply: (startDate: string) => Partial<FormState> }[] = [
  {
    id: "standup",
    label: "Daily stand-up",
    hint: "Weekdays · 15 min",
    apply: () => ({ title: "Daily stand-up", kind: "RECURRING", durationMin: 15, time: "10:00", freq: "WEEKLY", interval: 1, byWeekday: ["MO", "TU", "WE", "TH", "FR"], endType: "NEVER" }),
  },
  {
    id: "weekly",
    label: "Weekly sync",
    hint: "Every week · 1 hr",
    apply: (d) => ({ title: "Weekly sync", kind: "RECURRING", durationMin: 60, freq: "WEEKLY", interval: 1, byWeekday: [weekdayCode(`${d}T00:00`)], endType: "NEVER" }),
  },
  {
    id: "sprint",
    label: "Sprint planning",
    hint: "Every 2 weeks · 90 min",
    apply: (d) => ({ title: "Sprint planning", kind: "RECURRING", durationMin: 90, freq: "WEEKLY", interval: 2, byWeekday: [weekdayCode(`${d}T00:00`)], endType: "NEVER" }),
  },
  {
    id: "monthly",
    label: "Monthly review",
    hint: "Monthly · 1 hr",
    apply: () => ({ title: "Monthly review", kind: "RECURRING", durationMin: 60, freq: "MONTHLY", interval: 1, monthlyMode: "NTH_WEEKDAY", endType: "NEVER" }),
  },
  { id: "once", label: "One-time meeting", hint: "A single call", apply: () => ({ kind: "ONE_TIME" }) },
];

interface FormState {
  title: string;
  description: string;
  kind: "ONE_TIME" | "RECURRING";
  date: string;
  time: string;
  timezone: string;
  durationMin: number;
  freq: Freq;
  interval: number;
  byWeekday: Weekday[];
  monthlyMode: MonthlyMode;
  endType: EndType;
  untilDate: string;
  count: number;
  addMeet: boolean;
  sendInvites: boolean;
  guestsCanModify: boolean;
  guestsCanInvite: boolean;
  guestsCanSeeOthers: boolean;
  reminderMinutes: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function defaultStart(): { date: string; time: string } {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:00` };
}

function initialState(meeting: MeetingRow | null | undefined, viewerTz: string): FormState {
  if (meeting) {
    return {
      title: meeting.title,
      description: meeting.description ?? "",
      kind: meeting.kind,
      date: dateOnly(meeting.startLocal),
      time: meeting.startLocal.slice(11, 16),
      timezone: meeting.timezone,
      durationMin: meeting.durationMin,
      freq: meeting.freq ?? "WEEKLY",
      interval: meeting.interval,
      byWeekday: (meeting.byWeekday as Weekday[]).length ? (meeting.byWeekday as Weekday[]) : [weekdayCode(meeting.startLocal)],
      monthlyMode: meeting.monthlyMode ?? "DAY_OF_MONTH",
      endType: meeting.endType,
      untilDate: meeting.untilDate ?? "",
      count: meeting.occurrenceCount ?? 10,
      addMeet: meeting.addMeet,
      sendInvites: meeting.sendInvites,
      guestsCanModify: meeting.guestsCanModify,
      guestsCanInvite: meeting.guestsCanInvite,
      guestsCanSeeOthers: meeting.guestsCanSeeOthers,
      reminderMinutes: meeting.reminderMinutes,
    };
  }
  const { date, time } = defaultStart();
  return {
    title: "",
    description: "",
    kind: "ONE_TIME",
    date,
    time,
    timezone: viewerTz,
    durationMin: 30,
    freq: "WEEKLY",
    interval: 1,
    byWeekday: [weekdayCode(`${date}T${time}`)],
    monthlyMode: "DAY_OF_MONTH",
    endType: "NEVER",
    untilDate: "",
    count: 10,
    addMeet: true,
    sendInvites: true,
    guestsCanModify: false,
    guestsCanInvite: false,
    guestsCanSeeOthers: true,
    reminderMinutes: 10,
  };
}

const DEPT_LABEL: Record<string, string> = { DEV: "Dev", DESIGN: "Design", MARKETING: "Marketing", GENERAL: "General" };
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function MeetingForm({ members, meeting, viewerTz, onClose, onSaved }: Props) {
  const editing = !!meeting;
  const [f, setF] = useState<FormState>(() => initialState(meeting, viewerTz));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  // Team selection: userId → optional?
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    members.forEach((m) => m.email && (base[m.id] = m.email));
    meeting?.attendees.forEach((a) => a.userId && !base[a.userId] && (base[a.userId] = a.email));
    return base;
  });
  const [team, setTeam] = useState<Record<string, { optional: boolean }>>(() => {
    const sel: Record<string, { optional: boolean }> = {};
    meeting?.attendees.forEach((a) => a.userId && (sel[a.userId] = { optional: a.optional }));
    return sel;
  });
  const [guests, setGuests] = useState<Guest[]>(() => meeting?.attendees.filter((a) => !a.userId).map((a) => ({ email: a.email, optional: a.optional })) ?? []);
  const [guestDraft, setGuestDraft] = useState("");
  const [query, setQuery] = useState("");
  const [emailDraft, setEmailDraft] = useState<Record<string, string>>({});
  const [needsEmail, setNeedsEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const zones = useMemo(() => listTimeZones(), []);
  const startLocal = `${f.date}T${f.time}`;

  const rule: RecurrenceRule = useMemo(
    () => ({
      freq: f.freq,
      interval: f.interval,
      byWeekday: f.freq === "WEEKLY" ? f.byWeekday : [],
      monthlyMode: f.freq === "MONTHLY" ? f.monthlyMode : null,
      endType: f.endType,
      untilDate: f.endType === "ON_DATE" ? f.untilDate || null : null,
      count: f.endType === "AFTER_COUNT" ? f.count : null,
    }),
    [f.freq, f.interval, f.byWeekday, f.monthlyMode, f.endType, f.untilDate, f.count]
  );

  const payload = useMemo(() => {
    const attendees = [
      ...Object.entries(team)
        .filter(([id]) => memberEmails[id])
        .map(([id, v]) => {
          const m = members.find((x) => x.id === id)!;
          return { userId: id, email: memberEmails[id], displayName: m.displayName, optional: v.optional };
        }),
      ...guests.map((g) => ({ email: g.email, optional: g.optional })),
    ];
    return {
      title: f.title,
      description: f.description || null,
      kind: f.kind,
      startLocal,
      timezone: f.timezone,
      durationMin: f.durationMin,
      recurrence: f.kind === "RECURRING" ? rule : null,
      attendees,
      addMeet: f.addMeet,
      sendInvites: f.sendInvites,
      guestsCanModify: f.guestsCanModify,
      guestsCanInvite: f.guestsCanInvite,
      guestsCanSeeOthers: f.guestsCanSeeOthers,
      reminderMinutes: f.reminderMinutes,
    };
  }, [f, team, guests, memberEmails, members, rule, startLocal]);

  const validation = useMemo(() => meetingInputSchema.safeParse(payload), [payload]);
  const error = validation.success ? null : validation.error.errors[0]?.message ?? "Check the form";

  // ── derived preview ──
  const validStart = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startLocal) && isValidTimeZone(f.timezone);
  const startUtc = validStart ? zonedToUtc(startLocal, f.timezone) : null;
  const endUtc = startUtc ? new Date(startUtc.getTime() + f.durationMin * 60_000) : null;
  const next5 = useMemo(
    () => (f.kind === "RECURRING" && validStart && !error?.includes("repeat") ? generateOccurrences(rule, startLocal, { limit: 5 }) : []),
    [f.kind, rule, startLocal, validStart, error]
  );
  const inPast = startUtc ? startUtc.getTime() < Date.now() - 5 * 60_000 : false;
  const attendeeCount = payload.attendees.length;
  const selectedWithoutEmail = Object.keys(team).filter((id) => !memberEmails[id]).length;

  // ── people ──
  const visibleMembers = members.filter((m) => m.displayName.toLowerCase().includes(query.trim().toLowerCase()));
  const toggleMember = (id: string) => {
    if (!memberEmails[id]) return setNeedsEmail(id);
    setTeam((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = { optional: false };
      return n;
    });
  };
  const selectGroup = (dept: string | null) => {
    setTeam((p) => {
      const n = { ...p };
      members.filter((m) => (dept ? m.department === dept : true) && memberEmails[m.id]).forEach((m) => (n[m.id] = n[m.id] ?? { optional: false }));
      return n;
    });
  };
  const saveEmail = async (id: string) => {
    const email = (emailDraft[id] ?? "").trim().toLowerCase();
    if (!emailOk(email)) return toast.error("Enter a valid email address");
    const res = await saveMemberEmail({ userId: id, email });
    if (!res.success) return toast.error(res.error);
    setMemberEmails((p) => ({ ...p, [id]: email }));
    setTeam((p) => ({ ...p, [id]: { optional: false } }));
    setNeedsEmail(null);
    toast.success("Email saved for future meetings");
  };
  const addGuest = () => {
    const e = guestDraft.trim().toLowerCase();
    if (!e) return;
    if (!emailOk(e)) return toast.error("Enter a valid email address");
    if (guests.some((g) => g.email === e) || Object.keys(team).some((id) => memberEmails[id] === e)) return toast.error("That person is already invited");
    setGuests((p) => [...p, { email: e, optional: false }]);
    setGuestDraft("");
  };

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setF((prev) => {
      const patch = p.apply(prev.date);
      return { ...prev, ...patch, title: prev.title.trim() ? prev.title : (patch.title ?? prev.title) };
    });
  };

  const submit = async () => {
    setShowErrors(true);
    if (!validation.success) return toast.error(error ?? "Check the form");
    if (selectedWithoutEmail > 0) return toast.error("Add an email for every selected team member");
    setSaving(true);
    const res = editing ? await updateMeeting(meeting!.id, validation.data) : await createMeeting(validation.data);
    setSaving(false);
    if (!res.success) return toast.error(res.error);
    if (res.data.synced) {
      toast.success(editing ? "Meeting updated" : "Meeting scheduled", {
        description: res.data.meetUrl ? "Google Meet link is ready and invites are on their way." : undefined,
      });
    } else {
      toast.warning("Saved in IFlow, but Google didn’t accept it yet", { description: res.data.syncError, duration: 9000 });
    }
    onSaved();
  };

  const weekdayToggle = (d: Weekday) =>
    set("byWeekday", f.byWeekday.includes(d) ? f.byWeekday.filter((x) => x !== d) : [...f.byWeekday, d]);

  return (
    <Dialog
      size="xl"
      title={editing ? "Edit meeting" : "Schedule a meeting"}
      description={editing ? "Changes are sent to Google Calendar and attendees are notified." : "Creates a Google Calendar event with a Meet link and invites your team."}
      onClose={() => !saving && onClose()}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={submit} disabled={!!error && showErrors}>
            {editing ? "Save changes" : f.kind === "RECURRING" ? "Schedule series" : "Schedule meeting"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
        <div className="space-y-7 min-w-0">
          {/* Presets */}
          {!editing && (
            <div>
              <SectionLabel className="mb-2">Quick start</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className="text-left px-3 py-2 rounded-lg border border-surface-border bg-surface-base hover:border-foreground/20 hover:bg-primary/5 transition-colors">
                    <span className="block text-[12.5px] font-semibold text-foreground">{p.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <section className="space-y-3.5">
            <SectionLabel>Details</SectionLabel>
            <Field label="Title">
              <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Sprint planning" maxLength={200} autoFocus aria-label="Meeting title" />
            </Field>
            <Field label="Description" hint="Shown in the calendar invite. Optional.">
              <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Agenda, links, context…" rows={3} maxLength={4000} />
            </Field>
          </section>

          {/* When */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>When</SectionLabel>
              <Segmented
                value={f.kind}
                onChange={(v) => {
                  if (editing) return;
                  set("kind", v);
                }}
                options={[
                  { value: "ONE_TIME", label: "One time" },
                  { value: "RECURRING", label: <span className="flex items-center gap-1.5"><Repeat size={13} /> Repeating</span> },
                ]}
              />
            </div>
            {editing && <p className="text-[12px] text-muted-foreground -mt-1.5">A one-time meeting can’t become a series (or the reverse). Cancel it and schedule a new one instead.</p>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Date" className="col-span-1">
                <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} aria-label="Meeting date" />
              </Field>
              <Field label="Start time">
                <Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} aria-label="Start time" />
              </Field>
              <Field label="Duration (min)">
                <Input type="number" min={5} max={1440} step={5} value={f.durationMin} onChange={(e) => set("durationMin", Math.max(0, parseInt(e.target.value || "0", 10)))} aria-label="Duration in minutes" />
              </Field>
              <Field label="Time zone">
                <Input list="meeting-zones" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Kolkata" aria-label="Time zone" />
                <datalist id="meeting-zones">
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5 -mt-1">
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button key={m} type="button" onClick={() => set("durationMin", m)} className={cn("h-7 px-2.5 rounded-md border text-[12.5px] font-medium transition-colors", f.durationMin === m ? "border-primary/50 bg-primary/10 text-primary" : "border-surface-border text-muted-foreground hover:text-foreground")}>
                  {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${m / 60} hr`}
                </button>
              ))}
              {!isValidTimeZone(f.timezone) && <span className="text-[12px] text-red-500 self-center ml-2">Unknown time zone — pick one from the list</span>}
            </div>

            {f.kind === "RECURRING" && (
              <div className="rounded-lg border border-surface-border bg-surface-base p-4 space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Repeat every">
                    <Input type="number" min={1} max={MAX_INTERVAL} value={f.interval} onChange={(e) => set("interval", Math.max(1, parseInt(e.target.value || "1", 10)))} className="!w-20" aria-label="Repeat interval" />
                  </Field>
                  <Field label="Frequency">
                    <Select
                      value={f.freq}
                      onChange={(e) => {
                        const freq = e.target.value as Freq;
                        setF((p) => ({ ...p, freq, byWeekday: freq === "WEEKLY" && p.byWeekday.length === 0 ? [weekdayCode(startLocal)] : p.byWeekday }));
                      }}
                      className="!w-36"
                    >
                      <option value="DAILY">Day{f.interval > 1 ? "s" : ""}</option>
                      <option value="WEEKLY">Week{f.interval > 1 ? "s" : ""}</option>
                      <option value="MONTHLY">Month{f.interval > 1 ? "s" : ""}</option>
                      <option value="YEARLY">Year{f.interval > 1 ? "s" : ""}</option>
                    </Select>
                  </Field>
                </div>

                {f.freq === "WEEKLY" && (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground/80 mb-1.5">On</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button key={d} type="button" onClick={() => weekdayToggle(d)} aria-pressed={f.byWeekday.includes(d)} className={cn("h-9 w-12 rounded-lg border text-[12.5px] font-semibold transition-colors", f.byWeekday.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground")}>
                          {WEEKDAY_LABEL[d]}
                        </button>
                      ))}
                      <button type="button" onClick={() => set("byWeekday", ["MO", "TU", "WE", "TH", "FR"])} className="h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-primary hover:bg-primary/10 transition-colors">
                        Weekdays
                      </button>
                    </div>
                  </div>
                )}

                {f.freq === "MONTHLY" && validStart && (
                  <Field label="On">
                    <Select value={f.monthlyMode} onChange={(e) => set("monthlyMode", e.target.value as MonthlyMode)} className="sm:!w-72">
                      <option value="DAY_OF_MONTH">Day {Number(f.date.slice(8, 10))} of the month</option>
                      <option value="NTH_WEEKDAY">
                        The {["", "1st", "2nd", "3rd", "4th"][nthWeekdayOfStart(startLocal)] ?? "last"} {formatInZone(zonedToUtc(startLocal, f.timezone), f.timezone, { weekday: "long" })}
                      </option>
                    </Select>
                  </Field>
                )}

                <div className="space-y-2">
                  <label className="block text-[12px] font-semibold text-foreground/80">Ends</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Segmented
                      value={f.endType}
                      onChange={(v) => set("endType", v)}
                      options={[
                        { value: "NEVER", label: "Never" },
                        { value: "ON_DATE", label: "On date" },
                        { value: "AFTER_COUNT", label: "After" },
                      ]}
                    />
                    {f.endType === "ON_DATE" && <Input type="date" value={f.untilDate} min={f.date} onChange={(e) => set("untilDate", e.target.value)} className="!w-44" aria-label="End date" />}
                    {f.endType === "AFTER_COUNT" && (
                      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Input type="number" min={1} max={MAX_COUNT} value={f.count} onChange={(e) => set("count", Math.max(1, parseInt(e.target.value || "1", 10)))} className="!w-24" aria-label="Number of occurrences" /> meetings
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* People */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Who’s invited</SectionLabel>
              <span className="text-[12px] text-muted-foreground tabular-nums">{attendeeCount} invited</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => selectGroup(null)} className="h-7 px-2.5 rounded-full border border-surface-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                Everyone
              </button>
              {Array.from(new Set(members.map((m) => m.department))).map((d) => (
                <button key={d} type="button" onClick={() => selectGroup(d)} className="h-7 px-2.5 rounded-full border border-surface-border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                  + {DEPT_LABEL[d] ?? d}
                </button>
              ))}
              <button type="button" onClick={() => setTeam({})} className="h-7 px-2.5 rounded-full text-[12px] font-semibold text-muted-foreground hover:text-red-500 transition-colors">
                Clear
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team…" className="pl-9" aria-label="Search team members" />
            </div>

            <ul className="rounded-lg border border-surface-border divide-y divide-surface-border max-h-72 overflow-y-auto custom-scrollbar bg-surface-elevated">
              {visibleMembers.map((m) => {
                const on = !!team[m.id];
                const email = memberEmails[m.id];
                return (
                  <li key={m.id} className={cn("px-3 py-2", on && "bg-primary/[0.04]")}>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => toggleMember(m.id)} aria-pressed={on} aria-label={`${on ? "Remove" : "Invite"} ${m.displayName}`} className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors", on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary")}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </button>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ background: m.avatarColor }}>
                        {m.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground truncate">{m.displayName}</p>
                        <p className="text-[11.5px] text-muted-foreground truncate">{email ?? <span className="text-amber-500">No email yet</span>} · {DEPT_LABEL[m.department] ?? m.department}</p>
                      </div>
                      {on && (
                        <button type="button" onClick={() => setTeam((p) => ({ ...p, [m.id]: { optional: !p[m.id].optional } }))} className={cn("h-6 px-2 rounded-full text-[11px] font-semibold border transition-colors", team[m.id].optional ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" : "border-surface-border text-muted-foreground hover:text-foreground")} title="Optional attendees aren't required to attend">
                          {team[m.id].optional ? "Optional" : "Required"}
                        </button>
                      )}
                      {!email && (
                        <button type="button" onClick={() => setNeedsEmail(needsEmail === m.id ? null : m.id)} className="h-6 px-2 rounded-full text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                          <Mail size={11} /> Add email
                        </button>
                      )}
                    </div>
                    {needsEmail === m.id && !email && (
                      <div className="flex gap-2 mt-2 pl-8">
                        <Input autoFocus type="email" placeholder={`${m.displayName.split(" ")[0].toLowerCase()}@company.com`} value={emailDraft[m.id] ?? ""} onChange={(e) => setEmailDraft((p) => ({ ...p, [m.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveEmail(m.id))} className="!min-h-8 !py-[5px]" aria-label={`Email for ${m.displayName}`} />
                        <Button size="sm" variant="primary" type="button" onClick={() => saveEmail(m.id)}>
                          Save & invite
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
              {visibleMembers.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">No team members match.</li>}
            </ul>

            <div>
              <label className="block text-[12px] font-semibold text-foreground/80 mb-1.5">External guests</label>
              <div className="flex gap-2">
                <Input type="email" value={guestDraft} onChange={(e) => setGuestDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuest())} placeholder="client@example.com" aria-label="Guest email" />
                <Button type="button" onClick={addGuest}>
                  <Plus size={14} /> Add
                </Button>
              </div>
              {guests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {guests.map((g) => (
                    <span key={g.email} className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full border border-surface-border bg-surface-base text-[12.5px]">
                      {g.email}
                      <button type="button" onClick={() => setGuests((p) => p.map((x) => (x.email === g.email ? { ...x, optional: !x.optional } : x)))} className={cn("h-5 px-1.5 rounded-full text-[10.5px] font-semibold", g.optional ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "text-muted-foreground hover:text-foreground")}>
                        {g.optional ? "Optional" : "Required"}
                      </button>
                      <button type="button" aria-label={`Remove ${g.email}`} onClick={() => setGuests((p) => p.filter((x) => x.email !== g.email))} className="w-5 h-5 rounded-full hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center text-muted-foreground">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Options */}
          <section className="space-y-3">
            <SectionLabel>Options</SectionLabel>
            <div className="rounded-lg border border-surface-border divide-y divide-surface-border bg-surface-elevated">
              {[
                { k: "addMeet" as const, icon: <Video size={15} />, title: "Add a Google Meet link", body: meeting?.meetUrl ? "A Meet link already exists and can’t be removed." : "One link is shared by every occurrence.", disabled: !!meeting?.meetUrl },
                { k: "sendInvites" as const, icon: <Mail size={15} />, title: "Send Google email invites", body: "Attendees get an invitation and calendar updates by email." },
                { k: "guestsCanSeeOthers" as const, icon: <Users size={15} />, title: "Guests can see the guest list", body: "" },
                { k: "guestsCanInvite" as const, icon: <Plus size={15} />, title: "Guests can invite others", body: "" },
                { k: "guestsCanModify" as const, icon: <CalendarClock size={15} />, title: "Guests can modify the event", body: "Off is safer — only you can change the time." },
              ].map((o) => (
                <label key={o.k} className={cn("flex items-start gap-3 px-3.5 py-2.5 cursor-pointer", o.disabled && "opacity-60 cursor-not-allowed")}>
                  <input type="checkbox" className="mt-1 accent-primary w-4 h-4" checked={f[o.k]} disabled={o.disabled} onChange={(e) => set(o.k, e.target.checked)} />
                  <span className="mt-0.5 text-muted-foreground">{o.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-foreground">{o.title}</span>
                    {o.body && <span className="block text-[12px] text-muted-foreground">{o.body}</span>}
                  </span>
                </label>
              ))}
            </div>
            <Field label="Reminder">
              <Select value={f.reminderMinutes === null ? "default" : String(f.reminderMinutes)} onChange={(e) => set("reminderMinutes", e.target.value === "default" ? null : Number(e.target.value))} className="sm:!w-64">
                <option value="default">Calendar default</option>
                <option value="0">At the start</option>
                <option value="5">5 minutes before</option>
                <option value="10">10 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </Select>
            </Field>
          </section>
        </div>

        {/* Live summary */}
        <aside className="lg:sticky lg:top-0 self-start space-y-3">
          <div className="rounded-lg border border-surface-border bg-surface-base p-4 space-y-3.5">
            <SectionLabel>Summary</SectionLabel>
            <p className="text-[15px] font-semibold text-foreground leading-snug break-words">{f.title.trim() || <span className="text-muted-foreground font-normal">Untitled meeting</span>}</p>

            {startUtc && endUtc ? (
              <div className="space-y-2 text-[12.5px]">
                <p className="flex gap-2 text-foreground">
                  <CalendarClock size={14} className="mt-0.5 text-primary shrink-0" />
                  <span>
                    {formatInZone(startUtc, f.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    <br />
                    <b>{timeRange(startUtc, endUtc, f.timezone)}</b>
                  </span>
                </p>
                {viewerNote(startUtc, endUtc, f.timezone, viewerTz) && (
                  <p className="flex gap-2 text-muted-foreground">
                    <Globe2 size={14} className="mt-0.5 shrink-0" /> {viewerNote(startUtc, endUtc, f.timezone, viewerTz)} ({zoneAbbr(startUtc, viewerTz)})
                  </p>
                )}
                {f.kind === "RECURRING" && (
                  <p className="flex gap-2 text-foreground">
                    <Repeat size={14} className="mt-0.5 text-primary shrink-0" /> {describeRecurrence(rule, startLocal)}
                  </p>
                )}
                <p className="flex gap-2 text-muted-foreground">
                  <Clock size={14} className="mt-0.5 shrink-0" /> {f.durationMin} minutes
                </p>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">Pick a valid date, time and time zone.</p>
            )}

            {next5.length > 1 && (
              <div className="border-t border-surface-border pt-3">
                <p className="text-[11.5px] font-semibold text-muted-foreground mb-1.5">Next dates</p>
                <ul className="space-y-1">
                  {next5.map((o) => (
                    <li key={o} className="text-[12px] text-foreground tabular-nums">
                      {formatInZone(zonedToUtc(o, f.timezone), f.timezone, { weekday: "short", month: "short", day: "numeric" })}
                    </li>
                  ))}
                  <li className="text-[11.5px] text-muted-foreground">…</li>
                </ul>
              </div>
            )}

            <div className="border-t border-surface-border pt-3 flex flex-wrap gap-1.5">
              <Badge tone="primary">
                <Users size={11} /> {attendeeCount} invited
              </Badge>
              {f.addMeet && (
                <Badge tone="success">
                  <Video size={11} /> Meet
                </Badge>
              )}
              {f.sendInvites ? <Badge>Email invites on</Badge> : <Badge tone="warning">No email invites</Badge>}
            </div>
          </div>

          {(inPast || selectedWithoutEmail > 0 || (showErrors && error)) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] text-amber-700 dark:text-amber-400 space-y-1.5">
              {inPast && !editing && (
                <p className="flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> That start time is in the past.
                </p>
              )}
              {selectedWithoutEmail > 0 && (
                <p className="flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {selectedWithoutEmail} selected member{selectedWithoutEmail > 1 ? "s have" : " has"} no email.
                </p>
              )}
              {showErrors && error && (
                <p className="flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
                </p>
              )}
            </div>
          )}
          {editing && f.kind === "RECURRING" && (
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">Changing the time or repeat rule resets any individually edited or cancelled occurrences.</p>
          )}
        </aside>
      </div>
    </Dialog>
  );
}

export { ruleFromRow };
