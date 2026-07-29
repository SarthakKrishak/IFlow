"use client";

import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import type { Board, Column, Ticket, User, Label } from "@prisma/client";
import { TicketCard } from "./TicketCard";
import { QuickAddInput } from "./QuickAddInput";
import { Plus, AlertTriangle } from "lucide-react";

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
};

type ColumnWithTickets = Column & {
  tickets: TicketWithRelations[];
};

interface ColumnContainerProps {
  column: ColumnWithTickets;
  board: Board;
  currentUserId: string;
}

export function ColumnContainer({ column, board, currentUserId }: ColumnContainerProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const ticketIds = column.tickets.map((t) => t.id);
  const ticketCount = column.tickets.length;
  const overWipLimit = column.wipLimit !== null && column.wipLimit !== undefined && ticketCount > column.wipLimit;

  return (
    <div className="board-column flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{column.name}</h3>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              overWipLimit
                ? "bg-[#C79A3D]/20 text-[#C79A3D]"
                : "bg-surface-border text-muted-foreground"
            }`}
          >
            {ticketCount}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </span>
          {overWipLimit && (
            <span title="WIP limit exceeded">
              <AlertTriangle size={12} className="text-[#C79A3D] flex-shrink-0" />
            </span>
          )}
        </div>

        <button
          onClick={() => setShowQuickAdd(true)}
          className="p-1 rounded text-muted-foreground hover:text-text-secondary hover:bg-surface-border transition-all"
          aria-label={`Add ticket to ${column.name}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tickets */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 min-h-[80px] rounded-3xl p-2 transition-colors ${
          isOver ? "bg-[#5B5FEF]/5 border border-dashed border-[#5B5FEF]/30" : "bg-surface-elevated/50"
        }`}
      >
        <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
          {column.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </SortableContext>

        {column.tickets.length === 0 && !showQuickAdd && !isOver && (
          <div className="flex items-center justify-center h-16">
            <p className="text-xs text-muted-foreground">
              No tickets in {column.name} yet — add one to get started
            </p>
          </div>
        )}

        {/* Quick add */}
        {showQuickAdd && (
          <QuickAddInput
            boardId={board.id}
            columnId={column.id}
            onClose={() => setShowQuickAdd(false)}
          />
        )}
      </div>

      {/* Add ticket button at bottom */}
      {!showQuickAdd && column.name.toLowerCase() !== "backlog" && (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-3 p-4 rounded-2xl text-[15px] font-medium text-primary hover:bg-primary/5 transition-all w-full border border-dashed border-surface-border shadow-sm mt-2"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add ticket
        </button>
      )}
    </div>
  );
}
