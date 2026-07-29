"use client";

import { AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { TicketPanel, type TicketFull } from "@/components/board/TicketPanel";
import { useState, useEffect } from "react";
import { pingPresence } from "@/server/actions/ping";
import type { Board, Column, Ticket, User, Label } from "@/lib/prisma-client";

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
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
  const { openTicketId } = useUIStore();
  const [openTicketData, setOpenTicketData] = useState<TicketFull | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);

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

  // Fetch full ticket data when panel opens
  useEffect(() => {
    if (!openTicketId) {
      setOpenTicketData(null);
      return;
    }
    setIsLoadingTicket(true);
    fetch(`/api/tickets/${openTicketId}`)
      .then((r) => r.json())
      .then((data: TicketFull) => {
        setOpenTicketData(data);
        setIsLoadingTicket(false);
      })
      .catch(() => setIsLoadingTicket(false));
  }, [openTicketId]);

  const allColumns = columns.map((c) => ({ id: c.id, name: c.name, order: c.order }));

  // Calculate online users (last seen within 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = allUsers.filter(u => u.lastSeenAt && new Date(u.lastSeenAt) >= fiveMinutesAgo);

  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-semibold text-text-primary">{board.name}</h1>
            {board.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{board.description}</p>
            )}
          </div>
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-2 border-l border-surface-border pl-4">
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 5).map(user => (
                  <div key={user.id} className="relative group">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ring-2 ring-surface-base" style={{ backgroundColor: user.avatarColor }}>
                      {user.displayName.charAt(0)}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-1 ring-surface-base"></div>
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium">{onlineUsers.length} online</span>
            </div>
          )}
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
    </div>
  );
}
