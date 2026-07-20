"use client";

import { AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { TicketPanel, type TicketFull } from "@/components/board/TicketPanel";
import { useState, useEffect } from "react";
import type { Board, Column, Ticket, User, Label } from "@prisma/client";

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
  allUsers: Pick<User, "id" | "displayName" | "avatarColor" | "isActive">[];
  allLabels: Pick<Label, "id" | "name" | "color">[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MEMBER";
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-surface-border flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-text-primary">{board.name}</h1>
          {board.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{board.description}</p>
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
    </div>
  );
}
