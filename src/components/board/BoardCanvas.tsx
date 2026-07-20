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
  const { setOpenTicketId } = useUIStore();

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
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

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeColId = findColumnByTicketId(active.id as string)?.id;
      let overColId: string | undefined;

      // Determine if we're over a column or a ticket
      const overColumn = columns.find((c) => c.id === over.id);
      if (overColumn) {
        overColId = overColumn.id;
      } else {
        overColId = findColumnByTicketId(over.id as string)?.id;
      }

      if (!activeColId || !overColId) return;
      if (activeColId === overColId) return;

      setColumns((prev) => {
        const newCols = prev.map((col) => ({ ...col, tickets: [...col.tickets] }));
        const fromCol = newCols.find((c) => c.id === activeColId)!;
        const toCol = newCols.find((c) => c.id === overColId)!;

        const activeIndex = fromCol.tickets.findIndex((t) => t.id === active.id);
        const [ticket] = fromCol.tickets.splice(activeIndex, 1);

        const overIndex = toCol.tickets.findIndex((t) => t.id === over.id);
        const insertAt = overIndex >= 0 ? overIndex : toCol.tickets.length;
        toCol.tickets.splice(insertAt, 0, { ...ticket, columnId: overColId! });

        return newCols;
      });
    },
    [columns, findColumnByTicketId]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTicket(null);

      if (!over) return;

      // Find where the ticket ended up after optimistic update
      const destinationCol = findColumnByTicketId(active.id as string);
      if (!destinationCol) return;

      // Handle same-column reorder
      if (active.id !== over.id) {
        const overInSameCol = destinationCol.tickets.find((t) => t.id === over.id);
        if (overInSameCol) {
          setColumns((prev) =>
            prev.map((col) => {
              if (col.id !== destinationCol.id) return col;
              const oldIndex = col.tickets.findIndex((t) => t.id === active.id);
              const newIndex = col.tickets.findIndex((t) => t.id === over.id);
              if (oldIndex === -1 || newIndex === -1) return col;
              return { ...col, tickets: arrayMove(col.tickets, oldIndex, newIndex) };
            })
          );
        }
      }

      const finalCol = columns.find((c) => c.id === destinationCol.id) ?? destinationCol;
      const finalOrder = finalCol.tickets.findIndex((t) => t.id === active.id);

      // Persist to server
      const result = await moveTicket({
        ticketId: active.id as string,
        toColumnId: destinationCol.id,
        toOrder: finalOrder,
      });

      if (result.success) {
        // toast.success("Ticket moved"); // Might be too noisy for drag-and-drop
      } else {
        toast.error("Failed to move ticket");
        // Revert columns if needed...
      }
    },
    [columns, findColumnByTicketId]
  );

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
