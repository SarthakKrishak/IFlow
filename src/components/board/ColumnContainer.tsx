"use client";

import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import type { Board, Column, Ticket, User, Label } from "@prisma/client";
import { TicketCard } from "./TicketCard";
import { QuickAddInput } from "./QuickAddInput";
import { Plus, AlertTriangle } from "lucide-react";

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

function columnDot(name: string) {
  const n = name.toLowerCase();
  if (n.includes("backlog")) return "bg-slate-400";
  if (n.includes("to do") || n === "todo") return "bg-slate-400";
  if (n.includes("progress")) return "bg-blue-500";
  if (n.includes("review")) return "bg-amber-500";
  if (n.includes("done") || n.includes("complet")) return "bg-emerald-500";
  return "bg-primary";
}

export function ColumnContainer({ column, board, currentUserId, savingTickets }: ColumnContainerProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const ticketIds = column.tickets.map((t) => t.id);
  const ticketCount = column.tickets.length;
  const overWipLimit = column.wipLimit !== null && column.wipLimit !== undefined && ticketCount > column.wipLimit;

  return (
    <div className="board-column flex flex-col gap-2">
      {/* Column header — Jira style */}
      <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-surface-elevated border border-surface-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${columnDot(column.name)}`} />
          <h3 className="text-[11.5px] font-bold text-foreground uppercase tracking-wider truncate">
            {column.name}
          </h3>
          <span
            className={`text-[11px] font-bold font-mono px-1.5 py-px rounded-md ${
              overWipLimit ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-surface-base text-muted-foreground"
            }`}
          >
            {ticketCount}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </span>
          {overWipLimit && (
            <span title="WIP limit exceeded">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
            </span>
          )}
        </div>

        <button
          onClick={() => setShowQuickAdd(true)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-base transition-all"
          aria-label={`Add ticket to ${column.name}`}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Tickets lane */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-[120px] rounded-2xl p-2 transition-colors border ${
          isOver
            ? "bg-primary/[0.06] border-dashed border-primary/40"
            : "bg-surface-base/70 border-transparent"
        }`}
      >
        <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
          {column.tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} isSaving={savingTickets.has(ticket.id)} />
          ))}
        </SortableContext>

        {column.tickets.length === 0 && !showQuickAdd && !isOver && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center border border-dashed border-surface-border rounded-xl">
            <p className="text-[11.5px] font-medium text-muted-foreground">No issues</p>
            <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">Drag here or create one</p>
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
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated border border-transparent hover:border-surface-border transition-all w-full"
        >
          <Plus size={14} strokeWidth={2.5} />
          Create
        </button>
      )}
    </div>
  );
}
