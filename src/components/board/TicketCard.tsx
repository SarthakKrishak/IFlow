"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Ticket, User, Label } from "@/lib/prisma-client";
import { PriorityChip, Avatar, RelativeTime } from "@/components/shared";
import { MessageSquare, Calendar, Tag, MoreVertical } from "lucide-react";
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
      className="cursor-pointer rounded-2xl p-3.5 transition-all select-none relative group overflow-hidden shadow-sm flex flex-col gap-2"
      style={{
        ...style,
        background: "hsl(var(--surface-elevated))",
        border: "1px solid hsl(var(--surface-border))",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderRightColor = "#363D4E";
        (e.currentTarget as HTMLDivElement).style.borderTopColor = "#363D4E";
        (e.currentTarget as HTMLDivElement).style.borderBottomColor = "#363D4E";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderRightColor = "hsl(var(--surface-border))";
        (e.currentTarget as HTMLDivElement).style.borderTopColor = "hsl(var(--surface-border))";
        (e.currentTarget as HTMLDivElement).style.borderBottomColor = "hsl(var(--surface-border))";
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
      {/* Menu Icon */}
      <div className="absolute top-3 right-2 text-muted-foreground/60 hover:text-white transition-colors p-1 rounded-md z-10">
        <MoreVertical size={16} />
      </div>
      {/* Labels */}
      {ticket.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pr-6">
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                color: label.color,
                background: `${label.color}15`,
                border: `1px solid ${label.color}25`,
              }}
            >
              <Tag size={10} strokeWidth={2.5} />
              {label.name}
            </span>
          ))}
          {extraLabelCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] text-muted-foreground bg-surface-border">
              +{extraLabelCount}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-[14.5px] text-white font-bold line-clamp-2 leading-snug pr-6 tracking-tight">
        {ticket.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {ticket.assignee && (
            <Avatar
              displayName={ticket.assignee.displayName}
              avatarColor={ticket.assignee.avatarColor}
              size="sm"
            />
          )}
          <PriorityChip priority={ticket.priority} className="!rounded-lg !px-1.5 !py-0.5 !text-[10px]" />
          {dueDateStyle && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap"
              style={{
                color: dueDateStyle.color,
                background: `${dueDateStyle.color}15`,
                border: `1px solid ${dueDateStyle.color}25`
              }}
            >
              <Calendar size={11} strokeWidth={2.5} />
              {dueDateStyle.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity ml-auto">
          {ticket._count.comments > 0 && (
            <>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80 font-medium">
                <MessageSquare size={11} strokeWidth={2} />
                {ticket._count.comments}
              </span>
              <span className="text-muted-foreground/40 text-[9px] mx-0.5">·</span>
            </>
          )}
          <span className="text-[11px] text-muted-foreground/80 font-medium">
            <RelativeTime date={ticket.lastActivityAt} />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
