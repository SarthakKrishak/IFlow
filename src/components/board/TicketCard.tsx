"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Ticket, User, Label } from "@prisma/client";
import { PriorityChip, Avatar, RelativeTime } from "@/components/shared";
import { MessageSquare } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { motion } from "framer-motion";

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
};

interface TicketCardProps {
  ticket: TicketWithRelations;
  isDragging?: boolean;
}

function getDueDateStyle(dueDate: Date | null): { color: string; text: string } | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) return { color: "#D1495B", text: due.toLocaleDateString() };
  if (diffHours <= 48) return { color: "#C79A3D", text: due.toLocaleDateString() };
  return { color: "hsl(var(--muted-foreground))", text: due.toLocaleDateString() };
}

export function TicketCard({ ticket, isDragging = false }: TicketCardProps) {
  const { setOpenTicketId } = useUIStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: ticket.id,
    data: { type: "ticket", ticket },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  const visibleLabels = ticket.labels.slice(0, 3);
  const extraLabelCount = ticket.labels.length - 3;
  const dueDateStyle = getDueDateStyle(ticket.dueDate);

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout
      layoutId={ticket.id}
      whileHover={{ scale: isDragging ? 1 : 1.01 }}
      transition={
        isDragging
          ? { type: "spring", stiffness: 500, damping: 35 }
          : { duration: 0.15 }
      }
      onClick={(e) => {
        // Don't open panel if click was on drag handle movement
        if (!isDragging) {
          e.stopPropagation();
          setOpenTicketId(ticket.id);
        }
      }}
      className="cursor-pointer rounded-2xl p-3 transition-colors select-none"
      style={{
        ...style,
        background: "hsl(var(--surface-elevated))",
        border: "1px solid hsl(var(--surface-border))",
      }}

      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#363D4E";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--surface-border))";
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ticket: ${ticket.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpenTicketId(ticket.id);
        }
      }}
    >
      {/* Labels */}
      {ticket.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                color: label.color,
                background: `${label.color}20`,
                border: `1px solid ${label.color}30`,
              }}
            >
              {label.name}
            </span>
          ))}
          {extraLabelCount > 0 && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-surface-border">
              +{extraLabelCount}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-sm text-text-primary font-medium line-clamp-2 leading-snug mb-2">
        {ticket.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2 min-w-0">
          {ticket.assignee && (
            <Avatar
              displayName={ticket.assignee.displayName}
              avatarColor={ticket.assignee.avatarColor}
              size="sm"
            />
          )}
          <PriorityChip priority={ticket.priority} />
          {dueDateStyle && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: dueDateStyle.color,
                background: `${dueDateStyle.color}18`,
              }}
            >
              {dueDateStyle.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {ticket._count.comments > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MessageSquare size={10} />
              {ticket._count.comments}
            </span>
          )}
          <RelativeTime date={ticket.lastActivityAt} />
        </div>
      </div>
    </motion.div>
  );
}
