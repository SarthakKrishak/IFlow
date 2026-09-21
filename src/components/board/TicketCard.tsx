"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Ticket, User, Label } from "@prisma/client";
import { Avatar, RelativeTime } from "@/components/shared";
import { MessageSquare, Calendar, MoreVertical, Loader2, CheckCircle2 } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { motion } from "framer-motion";
import { useRef } from "react";

type ExtraAssignee = { user: Pick<User, "id" | "displayName" | "avatarColor"> };

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  extraAssignees?: ExtraAssignee[];
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
};

interface TicketCardProps {
  ticket: TicketWithRelations;
  isDragging?: boolean;
  isSaving?: boolean;
}

const PRIORITY_BAR: Record<Ticket["priority"], string> = {
  LOW: "#10B981",
  MEDIUM: "#F59E0B",
  HIGH: "#EF4444",
  URGENT: "#B91C1C",
};

const PRIORITY_LABEL: Record<Ticket["priority"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function getDueDateStyle(dueDate: Date | null): { color: string; bg: string; text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0)
    return { color: "#E5484D", bg: "rgba(229,72,77,.12)", text: due.toLocaleDateString(), overdue: true };
  if (diffHours <= 48)
    return { color: "#F59E0B", bg: "rgba(245,158,11,.12)", text: due.toLocaleDateString(), overdue: false };
  return { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--surface-base))", text: due.toLocaleDateString(), overdue: false };
}

export function TicketCard({ ticket, isDragging = false, isSaving = false }: TicketCardProps) {
  const { setOpenTicketId } = useUIStore();
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
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
    opacity: isSortableDragging ? 0.35 : 1,
  };

  const isDone = !!ticket.completedAt;
  const dueDateStyle = getDueDateStyle(ticket.dueDate);

  // Combined assignees: primary + extra (dedupe)
  const allAssignees: Pick<User, "id" | "displayName" | "avatarColor">[] = [];
  if (ticket.assignee) allAssignees.push(ticket.assignee);
  (ticket.extraAssignees ?? []).forEach((a) => {
    if (!allAssignees.some((x) => x.id === a.user.id)) allAssignees.push(a.user);
  });
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraCount = allAssignees.length - visibleAssignees.length;

  const visibleLabels = ticket.labels.slice(0, 2);
  const extraLabelCount = ticket.labels.length - visibleLabels.length;

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout
      layoutId={ticket.id}
      whileHover={{ scale: isDragging ? 1 : 1.008 }}
      transition={isDragging ? { type: "spring", stiffness: 500, damping: 35 } : { duration: 0.12 }}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        // dnd-kit still emits click after a drag (PointerSensor distance:3):
        // ignore presses that actually moved, so dragging never opens the panel.
        const start = pointerDownPos.current;
        pointerDownPos.current = null;
        if (start) {
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (dx * dx + dy * dy > 25) return;
        }
        if (!isDragging) {
          e.stopPropagation();
          setOpenTicketId(ticket.id);
        }
      }}
      className="shrink-0 cursor-pointer rounded-xl transition-all select-none relative group shadow-sm flex flex-col gap-2 bg-surface-elevated border border-surface-border hover:border-primary/40 hover:shadow-md"
      style={{
        ...style,
        borderLeft: `3px solid ${PRIORITY_BAR[ticket.priority]}`,
        opacity: isSortableDragging ? 0.35 : isDone ? 0.78 : 1,
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
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
        {/* Top row: key + menu */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-wide text-muted-foreground/80">
            {ticket.id.slice(-6).toUpperCase()}
          </span>
          <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors p-0.5 rounded">
            {isSaving ? <Loader2 size={14} className="animate-spin text-primary" /> : <MoreVertical size={14} />}
          </span>
        </div>

        {/* Title */}
        <p
          className={`text-[13.5px] leading-snug tracking-tight pr-1 font-semibold ${
            isDone ? "text-muted-foreground line-through decoration-emerald-500/40" : "text-foreground"
          }`}
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {isDone && <CheckCircle2 size={12} className="inline mr-1 -mt-0.5 text-emerald-500" />}
          {ticket.title}
        </p>

        {/* Labels */}
        {ticket.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold"
                style={{ color: label.color, background: `${label.color}18` }}
              >
                {label.name}
              </span>
            ))}
            {extraLabelCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold text-muted-foreground bg-surface-base">
                +{extraLabelCount}
              </span>
            )}
          </div>
        )}

        {/* Footer: priority + due + assignees + meta */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
              style={{ color: PRIORITY_BAR[ticket.priority], background: `${PRIORITY_BAR[ticket.priority]}14` }}
              title={`Priority: ${PRIORITY_LABEL[ticket.priority]}`}
            >
              <span className="w-1 h-3 rounded-full" style={{ background: PRIORITY_BAR[ticket.priority] }} />
              {PRIORITY_LABEL[ticket.priority]}
            </span>
            {dueDateStyle && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                style={{ color: dueDateStyle.color, background: dueDateStyle.bg }}
                title={dueDateStyle.overdue ? "Overdue" : "Due date"}
              >
                <Calendar size={10} strokeWidth={2.5} />
                {dueDateStyle.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            {ticket._count.comments > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
                <MessageSquare size={11} strokeWidth={2} />
                {ticket._count.comments}
              </span>
            )}
            {visibleAssignees.length > 0 ? (
              <span className="flex -space-x-1.5">
                {visibleAssignees.map((u) => (
                  <Avatar key={u.id} displayName={u.displayName} avatarColor={u.avatarColor} size="sm" className="ring-2 ring-surface-elevated" />
                ))}
                {extraCount > 0 && (
                  <span className="w-6 h-6 rounded-full bg-surface-base border border-surface-border text-[9px] font-bold text-muted-foreground flex items-center justify-center ring-2 ring-surface-elevated">
                    +{extraCount}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/50">
                <RelativeTime date={ticket.lastActivityAt} />
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
