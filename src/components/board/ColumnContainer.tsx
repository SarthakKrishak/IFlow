"use client";

import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import type { Board, Column, Ticket, User, Label } from "@prisma/client";
import { TicketCard } from "./TicketCard";
import { QuickAddInput } from "./QuickAddInput";
import { Plus, AlertTriangle } from "lucide-react";
import { StageIcon, stageOf } from "@/components/shared/StatusGlyphs";

type ExtraAssignee = { user: Pick<User, "id" | "displayName" | "avatarColor"> };

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  extraAssignees?: ExtraAssignee[];
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
  savingTickets: Set<string>;
}

export function ColumnContainer({ column, board, currentUserId, savingTickets }: ColumnContainerProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const ticketIds = column.tickets.map((t) => t.id);
  const ticketCount = column.tickets.length;
  const overWipLimit = column.wipLimit !== null && column.wipLimit !== undefined && ticketCount > column.wipLimit;

  return (
    <div className="board-column flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between h-8 pl-2 pr-1">
        <div className="flex items-center gap-2 min-w-0">
          <StageIcon stage={stageOf(column.name)} />
          <h3 className="text-[13px] font-medium text-foreground truncate">{column.name}</h3>
          <span
            className={`text-[12px] tabular-nums ${overWipLimit ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}
            title={column.wipLimit ? `WIP limit ${column.wipLimit}` : undefined}
          >
            {ticketCount}
            {column.wipLimit ? ` / ${column.wipLimit}` : ""}
          </span>
          {overWipLimit && (
            <span title="WIP limit exceeded">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
            </span>
          )}
        </div>

        <button
          onClick={() => setShowQuickAdd(true)}
          className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          aria-label={`Add ticket to ${column.name}`}
          title="Add ticket"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Tickets lane */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1.5 min-h-[120px] rounded-xl p-1.5 transition-colors border ${
          isOver ? "bg-primary/[0.05] border-dashed border-primary/40" : "bg-foreground/[0.025] border-transparent"
        }`}
      >
        <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
          {column.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} isSaving={savingTickets.has(ticket.id)} />
          ))}
        </SortableContext>

        {column.tickets.length === 0 && !showQuickAdd && !isOver && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <p className="text-[12px] text-muted-foreground">No issues</p>
            <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">Drag a card here</p>
          </div>
        )}

        {showQuickAdd && (
          <QuickAddInput
            boardId={board.id}
            columnId={column.id}
            onClose={() => setShowQuickAdd(false)}
          />
        )}
      </div>

      {/* Create affordance */}
      {!showQuickAdd && (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-1.5 h-8 px-2 rounded-lg text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors w-full"
        >
          <Plus size={14} />
          New issue
        </button>
      )}
    </div>
  );
}
