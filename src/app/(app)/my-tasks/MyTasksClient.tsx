"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { Button, EmptyState, Input, Segmented, Select } from "@/components/ui";
import { PriorityIcon, PRIORITY_LABEL, StageIcon, stageOf, type Stage } from "@/components/shared/StatusGlyphs";
import { CheckCircle2 } from "lucide-react";

interface MyTasksClientProps {
  initialTickets: any[];
}

type Scope = "active" | "overdue" | "week" | "done" | "all";
type GroupBy = "status" | "board" | "due";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const DAY = 86400000;
const PAGE = 25;
const STAGE_ORDER: Stage[] = ["progress", "review", "todo", "backlog", "done"];
const PRIORITY_ORDER: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const isDoneStatus = (columnName: string) => /done|complet/i.test(columnName);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
/** Whole days from today to the due date (negative = overdue), or null. */
const daysUntil = (due: Date | string | null) => {
  if (!due) return null;
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / DAY);
};

function dueBucket(t: any): { key: string; label: string; order: number } {
  const n = daysUntil(t.dueDate);
  if (n === null) return { key: "none", label: "No due date", order: 4 };
  if (n < 0 && !isDoneStatus(t.column.name)) return { key: "overdue", label: "Overdue", order: 0 };
  if (n <= 0) return { key: "today", label: "Today", order: 1 };
  if (n < 7) return { key: "week", label: "Next 7 days", order: 2 };
  return { key: "later", label: "Later", order: 3 };
}

function DueText({ t }: { t: any }) {
  const n = daysUntil(t.dueDate);
  if (n === null) return <span className="text-muted-foreground/50">—</span>;
  const done = isDoneStatus(t.column.name);
  const date = new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const tone = done ? "text-muted-foreground" : n < 0 ? "text-red-600 dark:text-red-400" : n === 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  const rel = n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : null;
  return (
    <span className={`tabular-nums ${tone}`} title={new Date(t.dueDate).toDateString()}>
      {rel ?? date}
    </span>
  );
}

export function MyTasksClient({ initialTickets }: MyTasksClientProps) {
  const [scope, setScope] = useState<Scope>("active");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    const h = setTimeout(() => setQuery(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(h);
  }, [searchInput]);

  const boards = useMemo(() => Array.from(new Set(initialTickets.map((t) => t.board.name))).sort(), [initialTickets]);

  // Scope counts are computed over everything, so the tabs always tell the truth.
  const scopeOf = useMemo(() => {
    const inScope: Record<Scope, (t: any) => boolean> = {
      active: (t) => !isDoneStatus(t.column.name),
      overdue: (t) => !isDoneStatus(t.column.name) && (daysUntil(t.dueDate) ?? 0) < 0,
      week: (t) => {
        const n = daysUntil(t.dueDate);
        return !isDoneStatus(t.column.name) && n !== null && n >= 0 && n < 7;
      },
      done: (t) => isDoneStatus(t.column.name),
      all: () => true,
    };
    return inScope;
  }, []);
  const counts = useMemo(() => {
    const c = { active: 0, overdue: 0, week: 0, done: 0, all: initialTickets.length } as Record<Scope, number>;
    initialTickets.forEach((t) => (["active", "overdue", "week", "done"] as Scope[]).forEach((s) => scopeOf[s](t) && c[s]++));
    return c;
  }, [initialTickets, scopeOf]);

  const filtered = useMemo(
    () =>
      initialTickets.filter(
        (t) =>
          scopeOf[scope](t) &&
          (boardFilter === "all" || t.board.name === boardFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter) &&
          (!query || t.title.toLowerCase().includes(query) || (t.description ?? "").toLowerCase().includes(query))
      ),
    [initialTickets, scope, boardFilter, priorityFilter, query, scopeOf]
  );

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; order: number; glyph: React.ReactNode; items: any[] }>();
    for (const t of filtered) {
      let g: { key: string; label: string; order: number; glyph: React.ReactNode };
      if (groupBy === "status") {
        const stage = stageOf(t.column.name);
        g = { key: t.column.name, label: t.column.name, order: STAGE_ORDER.indexOf(stage) * 100 + (t.column.order ?? 0), glyph: <StageIcon stage={stage} /> };
      } else if (groupBy === "board") {
        g = { key: t.board.name, label: t.board.name, order: 0, glyph: <span className="w-3.5 h-3.5 rounded bg-foreground/80 text-background text-[9px] font-semibold flex items-center justify-center">{t.board.name.charAt(0).toUpperCase()}</span> };
      } else {
        const b = dueBucket(t);
        g = { ...b, glyph: <span className={`w-2 h-2 rounded-full ${b.key === "overdue" ? "bg-red-500" : b.key === "today" ? "bg-amber-500" : b.key === "none" ? "bg-muted-foreground/30" : "bg-muted-foreground/70"}`} /> };
      }
      if (!map.has(g.key)) map.set(g.key, { ...g, items: [] });
      map.get(g.key)!.items.push(t);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    // Inside a group: most urgent first, then soonest due.
    list.forEach((g) =>
      g.items.sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority as Priority] - PRIORITY_ORDER[b.priority as Priority] ||
          (daysUntil(a.dueDate) ?? 9999) - (daysUntil(b.dueDate) ?? 9999)
      )
    );
    return list;
  }, [filtered, groupBy]);

  const filtersActive = query !== "" || boardFilter !== "all" || priorityFilter !== "all";
  const resetFilters = () => {
    setSearchInput("");
    setQuery("");
    setBoardFilter("all");
    setPriorityFilter("all");
  };
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const completion = counts.all > 0 ? Math.round((counts.done / counts.all) * 100) : 0;
  const scopes: { value: Scope; label: string; alert?: boolean }[] = [
    { value: "active", label: "Active" },
    { value: "overdue", label: "Overdue", alert: counts.overdue > 0 },
    { value: "week", label: "Due this week" },
    { value: "done", label: "Completed" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col min-h-full animate-fade-in">
      {/* ── Header: title · completion · scope tabs ── */}
      <div className="px-4 sm:px-6 lg:px-10 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">My tasks</h2>
            <p className="text-[13px] text-muted-foreground mt-1">Everything assigned to you, across every board.</p>
          </div>
          <div className="flex items-center gap-3" title={`${counts.done} of ${counts.all} completed`}>
            <div className="sm:text-right">
              <p className="text-[13px] text-foreground tabular-nums">
                {counts.done} <span className="text-muted-foreground">of {counts.all} done</span>
              </p>
              <div className="mt-1.5 w-40 h-1 rounded-full bg-foreground/[0.07] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-5 flex items-center gap-5 border-b border-surface-border overflow-x-auto no-scrollbar" aria-label="Task scope">
          {scopes.map((s) => {
            const active = scope === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                aria-current={active ? "page" : undefined}
                className={`h-10 -mb-px flex items-center gap-1.5 border-b-[1.5px] text-[13px] whitespace-nowrap transition-colors ${
                  active ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded text-[11px] tabular-nums inline-flex items-center justify-center ${
                    s.alert ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-foreground/[0.06] text-muted-foreground"
                  }`}
                >
                  {counts[s.value]}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-2 border-b border-surface-border [&>select]:flex-1 sm:[&>select]:flex-none">
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tasks…" className="pl-8 pr-8" aria-label="Search tasks" />
          {searchInput && (
            <button onClick={() => setSearchInput("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <Select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} className="!w-auto min-w-[130px]" aria-label="Filter by board">
          <option value="all">All boards</option>
          {boards.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="!w-auto min-w-[130px]" aria-label="Filter by priority">
          <option value="all">Any priority</option>
          {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>
        {filtersActive && (
          <button onClick={resetFilters} className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
            <X size={13} /> Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-[12.5px] text-muted-foreground">Group by</span>
          <Segmented
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "status", label: "Status" },
              { value: "due", label: "Due date" },
              { value: "board", label: "Board" },
            ]}
          />
        </div>
      </div>

      {/* ── Grouped list ── */}
      <div className="flex-1 pb-24">
        {groups.length === 0 ? (
          <div className="px-4 sm:px-6 lg:px-10 pt-10">
            <EmptyState
              icon={<CheckCircle2 />}
              title={
                initialTickets.length === 0
                  ? "Nothing assigned to you yet"
                  : filtersActive
                    ? "No tasks match these filters"
                    : scope === "overdue"
                      ? "Nothing overdue"
                      : scope === "week"
                        ? "Nothing due this week"
                        : "Nothing here"
              }
              description={initialTickets.length === 0 ? "When a teammate assigns you a task, it appears here." : filtersActive ? "Try a different search or clear the filters." : "You’re on top of things."}
              action={filtersActive ? <Button onClick={resetFilters}>Clear filters</Button> : undefined}
            />
          </div>
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const limit = limits[g.key] ?? PAGE;
            return (
              <section key={g.key}>
                <button
                  onClick={() => toggleGroup(g.key)}
                  aria-expanded={!isCollapsed}
                  className="sticky top-0 z-[2] w-full flex items-center gap-2 px-4 sm:px-6 lg:px-10 h-9 bg-surface-base/95 supports-[backdrop-filter]:bg-surface-base/80 backdrop-blur border-b border-surface-border text-left hover:bg-surface-hover transition-colors"
                >
                  <ChevronDown size={13} className={`text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  {g.glyph}
                  <span className="text-[13px] font-medium text-foreground">{g.label}</span>
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">{g.items.length}</span>
                </button>

                {!isCollapsed && (
                  <ul className="divide-y divide-surface-border border-b border-surface-border">
                    {g.items.slice(0, limit).map((t) => (
                      <TaskRow key={t.id} t={t} showStatus={groupBy !== "status"} showBoard={groupBy !== "board"} />
                    ))}
                    {g.items.length > limit && (
                      <li>
                        <button
                          onClick={() => setLimits((l) => ({ ...l, [g.key]: limit + PAGE }))}
                          className="w-full h-9 px-4 sm:px-6 lg:px-10 text-left text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-hover/60 transition-colors"
                        >
                          Show {Math.min(PAGE, g.items.length - limit)} more
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskRow({ t, showStatus, showBoard }: { t: any; showStatus: boolean; showBoard: boolean }) {
  const done = isDoneStatus(t.column.name);
  return (
    <li>
      <Link
        href={`/board/${t.boardId}?ticket=${t.id}`}
        className="group flex items-center gap-3 px-4 sm:px-6 lg:px-10 h-11 hover:bg-surface-hover/60 transition-colors"
      >
        <span title={`Priority: ${PRIORITY_LABEL[t.priority as Priority]}`} className="shrink-0">
          <PriorityIcon priority={t.priority} size={14} />
        </span>
        <span className="hidden sm:block w-[58px] shrink-0 font-mono text-[11.5px] text-muted-foreground">{t.id.slice(-6).toUpperCase()}</span>
        {showStatus && (
          <span title={t.column.name} className="shrink-0">
            <StageIcon stage={stageOf(t.column.name)} />
          </span>
        )}
        <span className={`min-w-0 truncate text-[13px] ${done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground font-medium"}`}>{t.title}</span>
        {t.labels?.length > 0 && (
          <span className="hidden md:flex items-center gap-1.5 shrink-0">
            {t.labels.slice(0, 2).map((l: any) => (
              <span key={l.id} className="h-5 inline-flex items-center gap-1.5 px-1.5 rounded-full border border-surface-border text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
          </span>
        )}
        <span className="flex-1" />
        {showBoard && <span className="hidden lg:block text-[12px] text-muted-foreground truncate max-w-[160px]">{t.board.name}</span>}
        <span className="w-[72px] shrink-0 text-right text-[12.5px]">
          <DueText t={t} />
        </span>
      </Link>
    </li>
  );
}
