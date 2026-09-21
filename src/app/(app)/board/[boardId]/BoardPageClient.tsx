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

  const totalTickets = columns.reduce((n, c) => n + c.tickets.length, 0);
  const doneCol = columns.find((c) => /done|complet/i.test(c.name));
  const doneCount = doneCol ? doneCol.tickets.length : 0;
  const donePct = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {/* Jira-style board header */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-surface-border flex-shrink-0 bg-surface-elevated/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {board.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold text-foreground tracking-tight truncate">{board.name}</h1>
              <span className="text-[10px] font-bold font-mono px-1.5 py-px rounded bg-surface-base border border-surface-border text-muted-foreground">
                {totalTickets} issues
              </span>
            </div>
            {board.description ? (
              <p className="text-[11.5px] text-muted-foreground truncate">{board.description}</p>
            ) : (
              <p className="text-[11.5px] text-muted-foreground/70">Team kanban board</p>
            )}
          </div>
        </div>

        {/* Done progress */}
        <div className="hidden md:flex items-center gap-2 ml-1">
          <div className="w-28 h-1.5 rounded-full bg-surface-border overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${donePct}%` }} />
          </div>
          <span className="text-[11px] font-bold text-muted-foreground font-mono">{donePct}% done</span>
        </div>

        {onlineUsers.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map(user => (
                <div key={user.id} className="relative group" title={user.displayName}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ring-2 ring-surface-elevated" style={{ backgroundColor: user.avatarColor }}>
                    {user.displayName.charAt(0)}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-1 ring-surface-elevated"></div>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-semibold">{onlineUsers.length} online</span>
          </div>
        )}
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
          <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-surface-elevated border-l border-surface-border flex items-center justify-center z-40">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm">Loading ticket...</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Load error (e.g. deleted ticket) — never render an error payload as a ticket */}
      <AnimatePresence>
        {openTicketId && ticketError && !isLoadingTicket && (
          <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-surface-elevated border-l border-surface-border flex items-center justify-center z-40 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold text-foreground">{ticketError}</p>
              <p className="text-xs text-muted-foreground">It may have been deleted or you may not have access.</p>
              <button
                onClick={closeTicketPanel}
                className="mt-1 px-4 py-2 rounded-xl bg-surface-base border border-surface-border text-[12.5px] font-bold text-foreground hover:border-primary/50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
