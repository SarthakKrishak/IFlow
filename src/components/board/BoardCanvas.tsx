"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Board, Column, Ticket, User, Label } from "@prisma/client";
import { ColumnContainer } from "./ColumnContainer";
import { TicketCard } from "./TicketCard";
import { moveTicket } from "@/server/actions/ticket.actions";
import { useUIStore } from "@/stores/ui.store";
import { toast } from "sonner";

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
};

type ColumnWithTickets = Column & {
  tickets: TicketWithRelations[];
};

interface BoardCanvasProps {
  board: Board;
  columns: ColumnWithTickets[];
  currentUserId: string;
}

export function BoardCanvas({ board, columns: initialColumns, currentUserId }: BoardCanvasProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null);
  const [savingTickets, setSavingTickets] = useState<Set<string>>(new Set());
  const { setOpenTicketId } = useUIStore();

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced from 8 to make drag initiation feel instant
      },
    })
  );

  const findTicketById = useCallback(
    (id: string) => {
      for (const col of columns) {
        const ticket = col.tickets.find((t) => t.id === id);
        if (ticket) return { ticket, column: col };
      }
      return null;
    },
    [columns]
  );

  const findColumnByTicketId = useCallback(
    (ticketId: string) => {
      return columns.find((col) => col.tickets.some((t) => t.id === ticketId));
    },
    [columns]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const found = findTicketById(event.active.id as string);
      if (found) setActiveTicket(found.ticket);
    },
    [findTicketById]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setColumns((prev) => {
      const activeCol = prev.find((col) => col.tickets.some((t) => t.id === active.id));
      if (!activeCol) return prev;

      const overCol = prev.find((col) => col.id === over.id) 
        || prev.find((col) => col.tickets.some((t) => t.id === over.id));
      
      if (!overCol || activeCol.id === overCol.id) return prev;

      const newCols = prev.map((col) => ({ ...col, tickets: [...col.tickets] }));
      const fromCol = newCols.find((c) => c.id === activeCol.id)!;
      const toCol = newCols.find((c) => c.id === overCol.id)!;

      const activeIndex = fromCol.tickets.findIndex((t) => t.id === active.id);
      if (activeIndex === -1) return prev;

      const [ticket] = fromCol.tickets.splice(activeIndex, 1);
      const overIndex = toCol.tickets.findIndex((t) => t.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : toCol.tickets.length;
      
      toCol.tickets.splice(insertAt, 0, { ...ticket, columnId: overCol.id });
      return newCols;
    });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    if (!over) return;

    let finalColId: string | undefined;
    let finalOrder: number | undefined;

    setColumns((prev) => {
      const activeCol = prev.find((col) => col.tickets.some((t) => t.id === active.id));
      if (!activeCol) return prev;

      const overCol = prev.find((col) => col.id === over.id)
        || prev.find((col) => col.tickets.some((t) => t.id === over.id));

      if (!overCol) {
        finalColId = activeCol.id;
        finalOrder = activeCol.tickets.findIndex((t) => t.id === active.id);
        return prev;
      }

      if (activeCol.id === overCol.id && active.id !== over.id) {
        const oldIndex = activeCol.tickets.findIndex((t) => t.id === active.id);
        const newIndex = activeCol.tickets.findIndex((t) => t.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newCols = prev.map((col) => {
            if (col.id !== activeCol.id) return col;
            return { ...col, tickets: arrayMove(col.tickets, oldIndex, newIndex) };
          });
          finalColId = activeCol.id;
          finalOrder = newIndex;
          return newCols;
        }
      }

      finalColId = activeCol.id;
      finalOrder = activeCol.tickets.findIndex((t) => t.id === active.id);
      return prev;
    });

    if (!finalColId || finalOrder === undefined || finalOrder === -1) return;

    // Fire and forget server persistence to keep UI immediately responsive
    setSavingTickets(prev => { const n = new Set(prev); n.add(active.id as string); return n; });
    moveTicket({
      ticketId: active.id as string,
      toColumnId: finalColId,
      toOrder: finalOrder,
    }).then((result) => {
      setSavingTickets(prev => { const n = new Set(prev); n.delete(active.id as string); return n; });
      if (!result.success) {
        toast.error("Failed to move ticket on server");
        // Could technically revert optimistic UI here, but a refresh handles it if they reload
      }
    });
  }, []);

  const allTicketIds = columns.flatMap((c) => c.tickets.map((t) => t.id));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board-canvas h-full p-6">
        {columns
          .sort((a, b) => a.order - b.order)
          .map((column) => (
            <ColumnContainer
              key={column.id}
              column={column}
              board={board}
              currentUserId={currentUserId}
              savingTickets={savingTickets}
            />
          ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          <div className="opacity-90 rotate-1 shadow-2xl">
            <TicketCard ticket={activeTicket} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
