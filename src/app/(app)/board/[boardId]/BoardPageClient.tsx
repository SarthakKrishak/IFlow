"use client";

import { AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import type { TicketFull } from "@/components/board/TicketPanel";
import dynamic from "next/dynamic";
import { PanelSkeleton } from "@/components/shared/Skeletons";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { pingPresence } from "@/server/actions/ping";
import { Search, X } from "lucide-react";
import { Badge, Button, Input, Progress, Select } from "@/components/ui";
import { getBoardFingerprint } from "@/server/actions/board.actions";
import type { Board, Column, Ticket, User, Label } from "@prisma/client";

// Ticket panel (tiptap-free but form-heavy) loads on first open, not with the board
const TicketPanel = dynamic(
  () => import("@/components/board/TicketPanel").then((m) => m.TicketPanel),
  { ssr: false, loading: () => <PanelSkeleton /> }
);

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  extraAssignees?: { user: Pick<User, "id" | "displayName" | "avatarColor"> }[];
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
};

type ColumnWithTickets = Column & {
  tickets: TicketWithRelations[];
};

interface BoardPageClientProps {
  board: Board;
  columns: ColumnWithTickets[];
  allUsers: Pick<User, "id" | "displayName" | "avatarColor" | "isActive" | "role" | "lastSeenAt">[];
  allLabels: Pick<Label, "id" | "name" | "color">[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MANAGER" | "MEMBER";
}

export function BoardPageClient({
  board,
  columns,
  allUsers,
  allLabels,
  currentUserId,
  currentUserRole,
}: BoardPageClientProps) {
  const { openTicketId, setOpenTicketId, closeTicketPanel } = useUIStore();
  const boardQuery = useUIStore((st) => st.boardQuery);
  const setBoardQuery = useUIStore((st) => st.setBoardQuery);
  const filterAssigneeId = useUIStore((st) => st.filterAssigneeId);
  const filterPriority = useUIStore((st) => st.filterPriority);
  const setFilter = useUIStore((st) => st.setFilter);
  const clearFilters = useUIStore((st) => st.clearFilters);
  const filtersActive = boardQuery !== "" || filterAssigneeId !== "all" || filterPriority !== "all";
  const [openTicketData, setOpenTicketData] = useState<TicketFull | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Presence ping only — no more router.refresh() polling every 8 seconds.
  // The board canvas updates via optimistic state on drag-and-drop.
  // Supabase Realtime handles live updates from other users.
  useEffect(() => {
    pingPresence();
    const interval = setInterval(() => {
      pingPresence();
    }, 30_000); // Ping every 30 seconds (presence only, no full page re-render)
    return () => clearInterval(interval);
  }, []);

  // Live updates: poll a tiny fingerprint every 10s; when a teammate creates,
  // moves, edits, assigns, comments or deletes, refresh so everyone sees it.
  // Skipped while the tab is hidden or a ticket panel is open (the panel has
  // its own fresh fetch, and we never yank the board under an open ticket).
  const fingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    fingerprintRef.current = null;
    let stopped = false;
    const check = async () => {
      if (stopped || document.hidden) return;
      if (useUIStore.getState().openTicketId) return;
      try {
        const res = await getBoardFingerprint(board.id);
        if (stopped || !res.success) return;
        if (fingerprintRef.current === null) {
          fingerprintRef.current = res.data;
          return;
        }
        if (fingerprintRef.current !== res.data) {
          fingerprintRef.current = res.data;
          router.refresh();
        }
      } catch {
        // Poll failures are silent — next tick retries
      }
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [board.id, router]);

  // Filters belong to one board — never carry them across boards.
  useEffect(() => {
    clearFilters();
    return () => clearFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  // A ticket id left open on another board must never leak into this one.
  useEffect(() => {
    closeTicketPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  // Deep link support: /board/[id]?ticket=xxx (calendar, my-tasks, notifications)
  useEffect(() => {
    const ticketParam = searchParams.get("ticket");
    if (ticketParam && ticketParam !== openTicketId) {
      setOpenTicketId(ticketParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch full ticket data when panel opens (race-safe: only the latest
  // request may write state, and error payloads never reach the panel).
  useEffect(() => {
    if (!openTicketId) {
      setOpenTicketData(null);
      setTicketError(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsLoadingTicket(true);
    setTicketError(null);
    fetch(`/api/tickets/${openTicketId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Ticket not found" : "Couldn't load ticket");
        return (await r.json()) as TicketFull;
      })
      .then((data: TicketFull) => {
        if (requestIdRef.current !== requestId) return;
        // Clear the ?ticket= param once opened so refresh doesn't reopen
        if (searchParams.get("ticket")) {
          router.replace(pathname, { scroll: false });
        }
        setOpenTicketData(data);
        setIsLoadingTicket(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setOpenTicketData(null);
        setTicketError(err instanceof Error ? err.message : "Couldn't load ticket");
        setIsLoadingTicket(false);
      });
  }, [openTicketId, searchParams, router, pathname]);

  const allColumns = columns.map((c) => ({ id: c.id, name: c.name, order: c.order }));

  // Calculate online users (last seen within 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = allUsers.filter(u => u.lastSeenAt && new Date(u.lastSeenAt) >= fiveMinutesAgo);
  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  // Same rule as the assignee picker: admins aren't assignable, so they aren't filterable faces.
  const filterableUsers = allUsers.filter((u) => u.role !== "ADMIN" && u.isActive !== false);

  const totalTickets = columns.reduce((n, c) => n + c.tickets.length, 0);
  const doneCol = columns.find((c) => /done|complet/i.test(c.name));
  const doneCount = doneCol ? doneCol.tickets.length : 0;
  const donePct = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {/* Board header: identity · progress · filters · presence */}
      <header className="flex-shrink-0 border-b border-surface-border px-4 sm:px-6 pt-5 pb-3 space-y-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
          <h1 className="text-[20px] font-semibold text-foreground tracking-[-0.02em] truncate">{board.name}</h1>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {totalTickets} issue{totalTickets === 1 ? "" : "s"}
          </span>
          {board.description && <p className="basis-full text-[12.5px] text-muted-foreground truncate max-w-[560px]">{board.description}</p>}
        </div>

        {/* Filters: hide cards that don't match — drag & drop is unaffected */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Assignee quick filter: click a face to see only their cards */}
          {filterableUsers.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 pr-2 mr-1 border-r border-surface-border" role="group" aria-label="Quick filter by assignee">
              {filterableUsers.slice(0, 8).map((u) => {
                const on = filterAssigneeId === u.id;
                const dimmed = filterAssigneeId !== "all" && !on;
                return (
                  <button
                    key={u.id}
                    onClick={() => setFilter("filterAssigneeId", on ? "all" : u.id)}
                    aria-pressed={on}
                    title={on ? `Showing ${u.displayName}'s cards — click to clear` : `Only ${u.displayName}'s cards`}
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-semibold text-white transition-[opacity,box-shadow] ${
                      on ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:ring-2 hover:ring-foreground/20"
                    } ${dimmed ? "opacity-35 hover:opacity-80" : ""}`}
                    style={{ background: u.avatarColor }}
                  >
                    {u.displayName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    {onlineIds.has(u.id) && <span className="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input value={boardQuery} onChange={(e) => setBoardQuery(e.target.value)} placeholder="Filter cards…" className="pl-8" aria-label="Filter cards" />
          </div>
          <Select value={filterAssigneeId} onChange={(e) => setFilter("filterAssigneeId", e.target.value)} className="flex-1 sm:flex-none sm:!w-auto min-w-[130px]" aria-label="Filter by assignee">
            <option value="all">All assignees</option>
            <option value={currentUserId}>Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {allUsers
              .filter((u) => u.id !== currentUserId && u.role !== "ADMIN")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
          </Select>
          <Select value={filterPriority} onChange={(e) => setFilter("filterPriority", e.target.value)} className="flex-1 sm:flex-none sm:!w-auto min-w-[120px]" aria-label="Filter by priority">
            <option value="all">All priorities</option>
            {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
              <option key={p} value={p}>
                {p[0] + p.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          {filtersActive && (
            <button onClick={clearFilters} className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors">
              <X size={13} /> Clear
            </button>
          )}

          <div className="ml-auto flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2" title={`${doneCount} of ${totalTickets} done`}>
              <Progress value={donePct} tone="success" className="w-24 !h-1" />
              <span className="text-[12px] text-muted-foreground tabular-nums">{donePct}% done</span>
            </div>

            {onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex -space-x-1.5">
                  {onlineUsers.slice(0, 5).map((user) => (
                    <div key={user.id} className="relative" title={`${user.displayName} · online`}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-semibold ring-2 ring-background" style={{ backgroundColor: user.avatarColor }}>
                        {user.displayName.charAt(0)}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {onlineUsers.length} online
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Kanban canvas */}
      <div className="flex-1 overflow-hidden relative">
        <BoardCanvas
          board={board}
          columns={columns}
          currentUserId={currentUserId}
        />
      </div>

      {/* Ticket panel slide-over */}
      <AnimatePresence>
        {openTicketId && openTicketData && !isLoadingTicket && (
          <TicketPanel
            key={openTicketData.id}
            ticket={openTicketData}
            allUsers={allUsers}
            allLabels={allLabels}
            allColumns={allColumns}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        )}
      </AnimatePresence>

      {/* Loading indicator while ticket data is being fetched */}
      <AnimatePresence>
        {openTicketId && isLoadingTicket && (
          <div className="fixed inset-y-0 right-0 w-full sm:w-[min(880px,100vw)] bg-surface-elevated border-l border-surface-border flex items-center justify-center z-40">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-muted-foreground/25 border-t-muted-foreground rounded-full animate-spin" />
              <p className="text-[13px]">Loading ticket…</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Load error (e.g. deleted ticket) — never render an error payload as a ticket */}
      <AnimatePresence>
        {openTicketId && ticketError && !isLoadingTicket && (
          <div className="fixed inset-y-0 right-0 w-full sm:w-[min(880px,100vw)] bg-surface-elevated border-l border-surface-border flex items-center justify-center z-40 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold text-foreground">{ticketError}</p>
              <p className="text-xs text-muted-foreground">It may have been deleted or you may not have access.</p>
              <Button onClick={closeTicketPanel} className="mt-1">
                Close
              </Button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
