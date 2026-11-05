"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowRightLeft, CheckCircle, Loader2, MessageSquare, Tag, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Avatar } from "@/components/shared/Avatar";
import { DeploymentDashboardWidget } from "@/components/shared/DeploymentDashboardWidget";
import { PriorityIcon, StageIcon, stageOf } from "@/components/shared/StatusGlyphs";
import { Segmented, Select } from "@/components/ui";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface FocusTicket {
  id: string;
  title: string;
  dueDate: Date | string | null;
  priority: Priority;
  boardId: string;
  board: { name: string };
  column: { name: string };
}

interface OverviewProps {
  stats: {
    totalProjects: number;
    openTasks: number;
    inProgress: number;
    completed: number;
    sparklines: { created: number; inProg: number; done: number }[];
    trends: { projects: number; open: number; inProgress: number; completed: number };
  };
  projects: any[];
  activityLogs: any[];
  topActive: { id: string; displayName: string; avatarColor: string; count: number }[];
  chartTickets: any[];
  upcomingDeadlines: any[];
  teamStats: {
    total: number;
    online: any[];
    all: any[];
    trend: number;
    balanceScore: number;
    balanceText: string;
    workload?: { id: string; displayName: string; avatarColor: string; open: number }[];
  };
  range: number;
  projectId?: string;
  /** Signed-in user's display name, for the greeting. */
  viewerName?: string;
  /** The viewer's own open tickets, soonest due first. */
  myFocus?: FocusTicket[];
}

// Chart series — muted, distinguishable on light and dark, consistent across the page.
const SERIES = { Created: "#6E70E8", Completed: "#2E9E74", "In Progress": "#C8912D", Overdue: "#D9534F" } as const;
type SeriesKey = keyof typeof SERIES;
// Hairline layout for the 4 figures: 2×2 on small screens, 1×4 from lg.
const FIGURE_CELL = [
  "pr-5 border-r border-b lg:border-b-0",
  "pl-5 border-b lg:border-b-0 lg:border-r lg:pr-5",
  "pr-5 border-r lg:pl-5",
  "pl-5",
];
const MEDAL = ["text-amber-500", "text-zinc-400", "text-orange-700 dark:text-orange-500"];

const DAY = 86400000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function timeAgo(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < DAY) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / DAY)}d`;
}

/** "Today", "Tomorrow", "Fri", or "Nov 14" — plus an urgency tone. */
function dueLabel(due: Date | string | null): { text: string; tone: string } | null {
  if (!due) return null;
  const d = startOfDay(new Date(due));
  const days = Math.round((d.getTime() - startOfDay(new Date()).getTime()) / DAY);
  if (days < 0) return { text: `${-days}d overdue`, tone: "text-red-600 dark:text-red-400" };
  if (days === 0) return { text: "Today", tone: "text-amber-600 dark:text-amber-400" };
  if (days === 1) return { text: "Tomorrow", tone: "text-foreground" };
  if (days < 7) return { text: d.toLocaleDateString("en-US", { weekday: "short" }), tone: "text-muted-foreground" };
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), tone: "text-muted-foreground" };
}

export function OverviewDashboard({
  stats,
  projects,
  activityLogs,
  topActive = [],
  chartTickets,
  upcomingDeadlines,
  teamStats,
  range,
  projectId,
  viewerName,
  myFocus = [],
}: OverviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visibleActivities, setVisibleActivities] = useState(8);

  // ── Chart data (unchanged semantics) ──
  const chartDays = Array.from({ length: range }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (range - 1 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const chartData = chartDays.map((date) => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    let created = 0, completed = 0, inProgress = 0, overdue = 0;
    chartTickets.forEach((t) => {
      const col = t.column?.name.toLowerCase() ?? "";
      if (t.createdAt >= date && t.createdAt < nextDay) created++;
      if (col.includes("done") && t.updatedAt >= date && t.updatedAt < nextDay) completed++;
      if ((col.includes("progress") || col.includes("review")) && t.updatedAt >= date && t.updatedAt < nextDay) inProgress++;
      if (t.dueDate && new Date(t.dueDate) < new Date() && !col.includes("done") && t.updatedAt >= date && t.updatedAt < nextDay) overdue++;
    });
    return {
      fullDate: date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }),
      name: range > 7 ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : date.toLocaleDateString("en-US", { weekday: "short" }),
      Created: created,
      Completed: completed,
      "In Progress": inProgress,
      Overdue: overdue,
    };
  });

  const navigate = (mutate: (u: URL) => void) =>
    startTransition(() => {
      const url = new URL(window.location.href);
      mutate(url);
      router.push(url.pathname + url.search);
    });
  const updateRange = (r: string) => navigate((u) => u.searchParams.set("range", r));
  const updateProject = (pid: string) => navigate((u) => (pid ? u.searchParams.set("projectId", pid) : u.searchParams.delete("projectId")));

  // ── Header copy ──
  const firstName = (viewerName ?? "").trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const rangeText = range === 7 ? "week" : range === 30 ? "month" : "quarter";

  const overdueMine = myFocus.filter((t) => t.dueDate && startOfDay(new Date(t.dueDate)) < startOfDay(new Date())).length;
  const dueThisWeek = upcomingDeadlines.filter((t) => new Date(t.dueDate).getTime() - Date.now() < 7 * DAY).length;
  const summary = [
    myFocus.length > 0 ? `${myFocus.length}${myFocus.length === 6 ? "+" : ""} open task${myFocus.length === 1 ? "" : "s"} on your plate` : "Nothing assigned to you right now",
    overdueMine > 0 ? `${overdueMine} overdue` : null,
    dueThisWeek > 0 ? `${dueThisWeek} team deadline${dueThisWeek === 1 ? "" : "s"} this week` : null,
  ].filter(Boolean);

  const figures: { label: string; value: number; trend: number; spark: number[]; color: string }[] = [
    { label: "Projects", value: stats.totalProjects, trend: stats.trends.projects, spark: stats.sparklines.map((s) => s.created), color: SERIES.Created },
    { label: "Open tasks", value: stats.openTasks, trend: stats.trends.open, spark: stats.sparklines.map((s) => s.created - s.done), color: SERIES.Created },
    { label: "In progress", value: stats.inProgress, trend: stats.trends.inProgress, spark: stats.sparklines.map((s) => s.inProg), color: SERIES["In Progress"] },
    { label: "Completed", value: stats.completed, trend: stats.trends.completed, spark: stats.sparklines.map((s) => s.done), color: SERIES.Completed },
  ];

  const workload = (teamStats.workload ?? []).slice(0, 6);
  const maxLoad = Math.max(1, ...workload.map((w) => w.open));
  const onlineIds = new Set(teamStats.online.map((u: any) => u.id));

  return (
    <div id="dashboard-content" className="px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-12 sm:pb-20 max-w-[1440px] mx-auto animate-fade-in">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted-foreground">{today}</p>
          <h2 className="text-display text-[34px] sm:text-[46px] text-foreground mt-1">
            {greeting}
            {firstName && (
              <>
                , <em className="text-muted-foreground">{firstName}</em>
              </>
            )}
          </h2>
          <p className="text-[14px] text-muted-foreground mt-2.5">{summary.join(" · ")}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isPending && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
          <Select value={projectId || ""} onChange={(e) => updateProject(e.target.value)} className="flex-1 sm:flex-none sm:!w-auto min-w-[140px]" aria-label="Filter by project">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Segmented
            value={String(range)}
            onChange={(v) => updateRange(v === "7" ? "7d" : v === "30" ? "30d" : "90d")}
            options={[
              { value: "7", label: "Week" },
              { value: "30", label: "Month" },
              { value: "90", label: "Quarter" },
            ]}
          />
        </div>
      </header>

      {/* ── Figures band: open, between two rules — no boxes ─────────────── */}
      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 border-y border-surface-border" aria-label="Key numbers">
        {figures.map((f, i) => (
          <div key={f.label} className={`py-5 border-surface-border ${FIGURE_CELL[i]}`}>
            <p className="text-[12.5px] text-muted-foreground">{f.label}</p>
            <div className="flex items-end justify-between gap-3 mt-2">
              <p className="text-[26px] sm:text-[32px] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">{f.value}</p>
              <span className="hidden min-[400px]:block"><Sparkline color={f.color} points={f.spark} /></span>
            </div>
            <p className={`text-[12px] mt-2 tabular-nums ${f.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {f.trend >= 0 ? "+" : "−"}
              {Math.abs(Math.round(f.trend))}% <span className="text-muted-foreground">vs last {rangeText}</span>
            </p>
          </div>
        ))}
      </section>

      {/* ── Body: main column + rail ─────────────────────────────────────── */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-x-12 gap-y-12">
        <div className="space-y-12 min-w-0">
          {/* Your focus */}
          <Section
            title="Your focus"
            hint="Your open tasks, soonest due first"
            action={<SectionLink href="/my-tasks">All my tasks</SectionLink>}
          >
            {myFocus.length === 0 ? (
              <Quiet>You have no open tasks. Pick something up from a board, or enjoy the calm.</Quiet>
            ) : (
              <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden">
                {myFocus.map((t) => {
                  const due = dueLabel(t.dueDate);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/board/${t.boardId}?ticket=${t.id}`}
                        className="flex items-center gap-3 px-4 h-11 hover:bg-surface-hover/60 transition-colors"
                      >
                        <StageIcon stage={stageOf(t.column.name)} />
                        <span className="text-[13px] text-foreground font-medium truncate flex-1 min-w-0">{t.title}</span>
                        <span className="hidden sm:inline text-[12px] text-muted-foreground truncate max-w-[140px]">{t.board.name}</span>
                        <span title={`Priority: ${t.priority.toLowerCase()}`}>
                          <PriorityIcon priority={t.priority} size={13} />
                        </span>
                        <span className={`w-[78px] text-right text-[12px] tabular-nums ${due?.tone ?? "text-muted-foreground/60"}`}>{due?.text ?? "No date"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Throughput */}
          <Section
            title="Throughput"
            hint={`Last ${range} days`}
            action={
              <ul className="hidden sm:flex items-center gap-4 text-[12px] text-muted-foreground">
                {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-[3px] rounded-full" style={{ background: SERIES[k] }} />
                    {k}
                  </li>
                ))}
              </ul>
            }
          >
            <div className="relative h-[260px] -ml-2">
              {isPending && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--surface-border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11.5 }} axisLine={false} tickLine={false} tickMargin={10} minTickGap={20} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11.5 }} axisLine={false} tickLine={false} tickMargin={6} allowDecimals={false} width={36} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--muted-foreground) / 0.4)", strokeWidth: 1 }} />
                  {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={SERIES[k]}
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                      activeDot={{ r: 3.5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Projects */}
          <Section title="Projects" hint={`${projects.length} in this workspace`}>
            {projects.length === 0 ? (
              <Quiet>No projects yet. Create one from the project switcher in the sidebar.</Quiet>
            ) : (
              <div className="rounded-xl border border-surface-border overflow-hidden">
                <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_72px_72px_200px] gap-4 px-4 h-9 items-center text-[12px] text-muted-foreground border-b border-surface-border">
                  <span>Name</span>
                  <span className="text-right">Boards</span>
                  <span className="text-right">Open</span>
                  <span>Completion</span>
                </div>
                <ul className="divide-y divide-surface-border">
                  {projects.map((p) => (
                    <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_72px_72px_200px] gap-4 px-4 h-12 items-center">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-foreground text-background flex items-center justify-center text-[10.5px] font-semibold shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[13px] font-medium text-foreground truncate">{p.name}</span>
                      </span>
                      <span className="hidden sm:block text-right text-[13px] text-muted-foreground tabular-nums">{p.boardsCount || 0}</span>
                      <span className="hidden sm:block text-right text-[13px] text-muted-foreground tabular-nums">{p.openTasks || 0}</span>
                      <span className="flex items-center gap-3">
                        <span className="hidden sm:block flex-1 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                          <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, p.progress)}%` }} />
                        </span>
                        <span className="w-9 text-right text-[12.5px] text-muted-foreground tabular-nums">{p.progress}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Activity */}
          <Section title="Activity" hint="Latest changes across your boards">
            {activityLogs.length === 0 ? (
              <Quiet>No activity yet — moves, comments and assignments will appear here.</Quiet>
            ) : (
              <>
                <ol className="relative">
                  {activityLogs.slice(0, visibleActivities).map((log, i, arr) => (
                    <li key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < arr.length - 1 && <span className="absolute left-[11px] top-7 bottom-1 w-px bg-surface-border" aria-hidden="true" />}
                      <span className="relative w-6 h-6 rounded-full bg-surface-elevated ring-1 ring-surface-border flex items-center justify-center text-muted-foreground shrink-0">
                        {activityIcon(log.action)}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[13px] text-muted-foreground leading-snug">
                          <span className="font-medium text-foreground">{log.user.displayName}</span> {log.action.toLowerCase().replace(/_/g, " ")}{" "}
                          <span className="text-foreground">{log.ticket.title}</span>
                        </p>
                        <p className="text-[12px] text-muted-foreground/80 mt-0.5">
                          {log.ticket.board.name} · {timeAgo(log.createdAt)}
                          {timeAgo(log.createdAt) !== "just now" && " ago"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {visibleActivities < activityLogs.length && (
                  <button
                    onClick={() => setVisibleActivities((v) => v + 8)}
                    className="mt-4 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </Section>
        </div>

        {/* ── Rail ── */}
        <aside className="space-y-10 lg:border-l lg:border-surface-border lg:pl-10 min-w-0">
          <Section title="Coming up" action={<SectionLink href="/calendar">Calendar</SectionLink>}>
            {upcomingDeadlines.length === 0 ? (
              <Quiet>No upcoming deadlines.</Quiet>
            ) : (
              <ol className="space-y-1">
                {upcomingDeadlines.map((t) => {
                  const d = new Date(t.dueDate);
                  const due = dueLabel(t.dueDate);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/board/${t.boardId}?ticket=${t.id}`}
                        className="flex gap-3 -mx-2 px-2 py-2 rounded-lg hover:bg-surface-hover/60 transition-colors"
                      >
                        <span className="w-9 shrink-0 text-center leading-none pt-0.5">
                          <span className="block text-[10.5px] text-muted-foreground">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="block text-[17px] font-semibold text-foreground tabular-nums mt-1">{d.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-foreground truncate">{t.title}</span>
                          <span className="block text-[12px] text-muted-foreground truncate mt-0.5">
                            <span className={due?.tone}>{due?.text}</span> · {t.board.name}
                          </span>
                        </span>
                        {t.assignee && (
                          <span className="pt-0.5">
                            <Avatar name={t.assignee.displayName} color={t.assignee.avatarColor} size="xs" />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          {topActive.length > 0 && (
            <Section title={`Most active this ${rangeText}`}>
              <ol className="space-y-2.5">
                {topActive.map((u, i) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <Trophy size={14} strokeWidth={2.25} className={MEDAL[i] ?? "text-muted-foreground"} />
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10.5px] font-semibold shrink-0"
                      style={{ background: u.avatarColor }}
                    >
                      {u.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate flex-1">{u.displayName}</span>
                    <span className="text-[12.5px] text-muted-foreground tabular-nums">{u.count} actions</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section
            title="Team load"
            hint={`${teamStats.online.length} of ${teamStats.total} online`}
            action={<SectionLink href="/people">People</SectionLink>}
          >
            {workload.length === 0 ? (
              <Quiet>{teamStats.balanceText}.</Quiet>
            ) : (
              <>
                <ul className="space-y-3">
                  {workload.map((w) => (
                    <li key={w.id}>
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span className="relative">
                          <Avatar name={w.displayName} color={w.avatarColor} size="xs" />
                          {onlineIds.has(w.id) && (
                            <span className="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                          )}
                        </span>
                        <span className="text-foreground truncate flex-1">{w.displayName}</span>
                        <span className="text-muted-foreground tabular-nums">{w.open} open</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${w.open === maxLoad && workload.length > 1 && teamStats.balanceScore < 80 ? "bg-amber-500" : "bg-foreground/60"}`}
                          style={{ width: `${(w.open / maxLoad) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-muted-foreground mt-3.5">{teamStats.balanceText}.</p>
              </>
            )}
          </Section>

          <DeploymentDashboardWidget />
        </aside>
      </div>
    </div>
  );
}

/* ── Building blocks ─────────────────────────────────────────────────────── */

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[14px] font-semibold text-foreground">
          {title}
          {hint && <span className="hidden sm:inline ml-2 text-[12.5px] font-normal text-muted-foreground">{hint}</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
      {children}
      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-muted-foreground py-6 px-4 rounded-xl border border-dashed border-surface-border">{children}</p>;
}

function Sparkline({ color, points = [] }: { color: string; points?: number[] }) {
  const W = 76, H = 26;
  const max = Math.max(...points, 4);
  const d =
    points.length > 1
      ? points.map((v, i) => `${i ? "L" : "M"}${((i * W) / (points.length - 1)).toFixed(1)} ${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`).join(" ")
      : `M0 ${H - 2} L${W} ${H - 2}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0" aria-hidden="true">
      <path d={d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover rounded-lg shadow-pop px-3 py-2.5 min-w-[160px]">
      <p className="text-[12px] font-medium text-foreground mb-2">{payload[0].payload.fullDate}</p>
      <div className="space-y-1.5">
        {payload.map((e: any) => (
          <div key={e.name} className="flex items-center justify-between gap-6 text-[12px]">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2.5 h-[3px] rounded-full" style={{ background: e.color }} />
              {e.name}
            </span>
            <span className="text-foreground font-medium tabular-nums">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function activityIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes("comment")) return <MessageSquare size={11} />;
  if (a.includes("move")) return <ArrowRightLeft size={11} />;
  if (a.includes("label")) return <Tag size={11} />;
  return <CheckCircle size={11} />;
}
