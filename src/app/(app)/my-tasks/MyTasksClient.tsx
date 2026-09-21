"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Circle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Flag,
  Inbox,
  RotateCcw,
} from "lucide-react";
import { PriorityChip } from "@/components/shared";
import Link from "next/link";

interface MyTasksClientProps {
  initialTickets: any[];
}

function isDoneStatus(columnName: string) {
  const n = columnName.toLowerCase();
  return n.includes("done") || n.includes("complet");
}

function statusMeta(columnName: string) {
  const n = columnName.toLowerCase();
  if (n.includes("done") || n.includes("complet"))
    return { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  if (n.includes("review"))
    return { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (n.includes("progress"))
    return { dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" };
  return { dot: "bg-slate-400", badge: "bg-slate-500/10 text-slate-500 border-slate-500/25" };
}

export function MyTasksClient({ initialTickets }: MyTasksClientProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Quick checkbox-style status filter (multi-select). Empty = all.
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [boardFilter, setBoardFilter] = useState("All Boards");
  const [priorityFilter, setPriorityFilter] = useState("Priority");
  const [hideDone, setHideDone] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const uniqueBoards = useMemo(
    () => Array.from(new Set(initialTickets.map((t) => t.board.name))),
    [initialTickets]
  );
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(initialTickets.map((t) => t.column.name))),
    [initialTickets]
  );
  const uniquePriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    initialTickets.forEach((t) => m.set(t.column.name, (m.get(t.column.name) ?? 0) + 1));
    return m;
  }, [initialTickets]);

  const toggleStatus = (s: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
    setCurrentPage(1);
  };

  const filteredTasks = useMemo(() => {
    return initialTickets.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (t.description ?? "").toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = activeStatuses.size === 0 || activeStatuses.has(t.column.name);
      const matchBoard = boardFilter === "All Boards" || t.board.name === boardFilter;
      const matchPriority = priorityFilter === "Priority" || t.priority === priorityFilter;
      const matchHideDone = !hideDone || !isDoneStatus(t.column.name);
      return matchSearch && matchStatus && matchBoard && matchPriority && matchHideDone;
    });
  }, [initialTickets, debouncedSearch, activeStatuses, boardFilter, priorityFilter, hideDone]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const stats = useMemo(() => {
    let todo = 0, inProgress = 0, inReview = 0, completed = 0, overdue = 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    initialTickets.forEach((t) => {
      const done = isDoneStatus(t.column.name);
      const status = t.column.name.toLowerCase();
      if (done) completed++;
      else if (status.includes("review")) inReview++;
      else if (status.includes("progress")) inProgress++;
      else todo++;
      if (t.dueDate && new Date(t.dueDate) < todayStart && !done) overdue++;
    });
    return { total: initialTickets.length, todo, inProgress, inReview, completed, overdue };
  }, [initialTickets]);

  const completionPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setActiveStatuses(new Set());
    setBoardFilter("All Boards");
    setPriorityFilter("Priority");
    setHideDone(false);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchInput !== "" || activeStatuses.size > 0 || boardFilter !== "All Boards" ||
    priorityFilter !== "Priority" || hideDone;

  const getRelativeTime = (dateStr: Date | string | null) => {
    if (!dateStr) return "No due date";
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  const isOverdue = (t: any) => {
    if (!t.dueDate || isDoneStatus(t.column.name)) return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return new Date(t.dueDate) < todayStart;
  };

  return (
    <div className="p-6 lg:p-8 pb-24 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* ── Header: summary + progress ─────────────────────────────── */}
      <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 lg:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Inbox size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground tracking-tight">My work queue</h2>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {stats.total} assigned · {stats.completed} done · {stats.overdue > 0 ? `${stats.overdue} overdue` : "nothing overdue"}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-4 lg:pr-2">
            <div className="w-40 sm:w-52">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completion</span>
                <span className="text-[11px] font-bold text-foreground font-mono">{completionPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />{stats.todo} to do</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />{stats.inProgress} active</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{stats.completed} done</span>
            </div>
          </div>
        </div>

        {/* Quick status checkboxes */}
        <div className="flex items-center gap-2 flex-wrap mt-5 pt-4 border-t border-surface-border">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Status</span>
          {uniqueStatuses.map((s) => {
            // Empty selection = "all" — report pressed=true so AT matches visuals
            const pressed = activeStatuses.size === 0 || activeStatuses.has(s);
            const meta = statusMeta(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                aria-pressed={pressed}
                title={activeStatuses.has(s) ? `Remove ${s} filter` : `Only show ${s}`}
                className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all ${
                  activeStatuses.has(s)
                    ? "border-primary/60 bg-primary/[0.08] text-foreground shadow-sm"
                    : pressed
                      ? "border-surface-border bg-surface-base text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      : "border-surface-border bg-surface-base text-muted-foreground/50 hover:text-foreground opacity-60"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                    activeStatuses.has(s) ? "bg-primary border-primary text-white" : "border-surface-border bg-surface-elevated"
                  }`}
                >
                  {activeStatuses.has(s) && <CheckCircle2 size={11} strokeWidth={3} />}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {s}
                <span className="font-mono text-[11px] opacity-70">({statusCounts.get(s) ?? 0})</span>
              </button>
            );
          })}
          <button
            onClick={() => { setHideDone(!hideDone); setCurrentPage(1); }}
            aria-pressed={hideDone}
            className="flex items-center gap-2 ml-1 pl-3 border-l border-surface-border text-[12px] font-medium text-muted-foreground hover:text-foreground cursor-pointer select-none transition-colors"
          >
            <span
              className={`w-3.5 h-3.5 rounded-[5px] border flex items-center justify-center transition-colors ${
                hideDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-surface-border bg-surface-elevated"
              }`}
            >
              {hideDone && <CheckCircle2 size={11} strokeWidth={3} />}
            </span>
            Hide done
          </button>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 ml-auto text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Toolbar: board / priority / search ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <Layers size={13} /> Board
          </span>
          <select
            value={boardFilter}
            onChange={(e) => { setBoardFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-semibold text-foreground outline-none cursor-pointer hover:border-primary/40 transition-colors"
          >
            <option value="All Boards">All boards</option>
            {uniqueBoards.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground ml-1">
            <Flag size={13} /> Priority
          </span>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-semibold text-foreground outline-none cursor-pointer hover:border-primary/40 transition-colors"
          >
            <option value="Priority">All priorities</option>
            {uniquePriorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="relative sm:ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search title or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-8 py-2 w-full sm:w-64 rounded-xl bg-surface-elevated border border-surface-border text-[12.5px] font-medium text-foreground outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/60"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Task list (Jira-style rows) ────────────────────────────── */}
      <div className="bg-surface-elevated border border-surface-border rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_150px_130px_120px_130px] gap-3 px-5 py-3 border-b border-surface-border bg-surface-base/60 text-[10.5px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>Task</span>
          <span>Status</span>
          <span>Board</span>
          <span>Priority</span>
          <span className="text-right">Due</span>
        </div>

        {paginatedTasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-500/50" />
            <p className="text-sm font-semibold text-foreground">No tasks match</p>
            <p className="text-xs mt-1 text-muted-foreground">Adjust filters or search — or enjoy the empty queue.</p>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold hover:opacity-90 transition-opacity">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {paginatedTasks.map((t) => {
              const done = isDoneStatus(t.column.name);
              const meta = statusMeta(t.column.name);
              const overdue = isOverdue(t);
              return (
                <li
                  key={t.id}
                  className={`relative transition-colors group ${
                    done
                      ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]"
                      : "hover:bg-surface-base"
                  }`}
                >
                  {/* done rail */}
                  <span
                    className={`absolute left-0 top-0 bottom-0 w-[3px] ${done ? "bg-emerald-500" : "bg-transparent group-hover:bg-primary/40"}`}
                  />
                  <div className="grid md:grid-cols-[minmax(0,1fr)_150px_130px_120px_130px] gap-2 md:gap-3 items-center px-5 py-3.5">
                    {/* Task */}
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400/60"
                      }`}>
                        {done && <CheckCircle2 size={11} strokeWidth={3.5} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10.5px] text-muted-foreground/70 flex-shrink-0">
                            {t.id.slice(-6).toUpperCase()}
                          </span>
                          {done && (
                            <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex-shrink-0">
                              Done
                            </span>
                          )}
                          {overdue && (
                            <span className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-red-500/10 text-red-500 border border-red-500/25 flex-shrink-0">
                              <AlertCircle size={9} /> Overdue
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/board/${t.boardId}?ticket=${t.id}`}
                          className={`block text-[13.5px] font-semibold truncate transition-colors ${
                            done ? "text-muted-foreground line-through decoration-emerald-500/50" : "text-foreground hover:text-primary"
                          }`}
                          title={t.title}
                        >
                          {t.title}
                        </Link>
                        <p className="text-[11.5px] text-muted-foreground/80 truncate">
                          {t.description || "No description"}
                          {t.labels?.length > 0 && (
                            <span className="ml-2">
                              {t.labels.slice(0, 3).map((l: any) => (
                                <span
                                  key={l.id}
                                  className="inline-block mr-1 px-1.5 py-px rounded text-[10px] font-semibold border"
                                  style={{ color: l.color, borderColor: `${l.color}40`, background: `${l.color}12` }}
                                >
                                  {l.name}
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {t.column.name}
                      </span>
                    </div>

                    {/* Board */}
                    <div className="text-[12px] font-medium text-muted-foreground truncate">{t.board.name}</div>

                    {/* Priority */}
                    <div><PriorityChip priority={t.priority} /></div>

                    {/* Due */}
                    <div className="flex items-center md:justify-end gap-2">
                      <Calendar size={13} className={overdue ? "text-red-500" : "text-muted-foreground"} />
                      <div className="leading-tight md:text-right">
                        <p className={`text-[12.5px] font-bold ${overdue ? "text-red-500" : done ? "text-muted-foreground" : "text-foreground"}`}>
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                            : "No date"}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground font-medium">{getRelativeTime(t.dueDate)}</p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-t border-surface-border bg-surface-base/60">
          <p className="text-[12px] font-medium text-muted-foreground">
            Showing {filteredTasks.length === 0 ? 0 : (safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length}
            {stats.overdue > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-500 font-semibold">
                <Clock size={11} /> {stats.overdue} overdue
              </span>
            )}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] font-bold text-foreground font-mono px-2">{safePage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-elevated text-[12px] font-semibold text-foreground outline-none cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "To do", value: stats.todo, icon: Circle, tint: "text-slate-500" },
          { label: "In progress", value: stats.inProgress, icon: Clock, tint: "text-blue-500" },
          { label: "In review", value: stats.inReview, icon: AlertCircle, tint: "text-amber-500" },
          { label: "Completed", value: stats.completed, icon: CheckCircle2, tint: "text-emerald-500" },
          { label: "Overdue", value: stats.overdue, icon: AlertCircle, tint: "text-red-500" },
          { label: "Total", value: stats.total, icon: Inbox, tint: "text-primary" },
        ].map((k) => (
          <div key={k.label} className="bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <k.icon size={17} className={k.tint} />
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold text-foreground leading-none mt-0.5 font-mono">{k.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
