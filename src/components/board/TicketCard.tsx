"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Ticket, User, Label } from "@prisma/client";
import { Avatar, RelativeTime } from "@/components/shared";
import { MessageSquare, Calendar, MoreHorizontal, Loader2, CheckCircle2, Layers } from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/stores/ui.store";
import { motion } from "framer-motion";
import { useRef } from "react";
import { PriorityIcon, PRIORITY_LABEL } from "@/components/shared/StatusGlyphs";

type ExtraAssignee = { user: Pick<User, "id" | "displayName" | "avatarColor"> };

type TicketWithRelations = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  extraAssignees?: ExtraAssignee[];
  labels: Pick<Label, "id" | "name" | "color">[];
  _count: { comments: number };
  /** Set when this card mirrors a Page Tracker work item. */
  trackerLink?: { workItemId: string; pageId: string; pageName: string; workstream: string } | null;
};

interface TicketCardProps {
  ticket: TicketWithRelations;
  isDragging?: boolean;
  isSaving?: boolean;
}

function getDueDateStyle(dueDate: Date | null): { cls: string; text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const diffMs = due.getTime() - Date.now();
  const text = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffMs < 0) return { cls: "text-red-600 dark:text-red-400 border-red-500/30", text, overdue: true };
  if (diffMs <= 48 * 3600 * 1000) return { cls: "text-amber-600 dark:text-amber-400 border-amber-500/30", text, overdue: false };
  return { cls: "text-muted-foreground border-surface-border", text, overdue: false };
}

export function TicketCard({ ticket, isDragging = false, isSaving = false }: TicketCardProps) {
  const { setOpenTicketId } = useUIStore();
  const query = useUIStore((s) => s.boardQuery);
  const assigneeFilter = useUIStore((s) => s.filterAssigneeId);
  const priorityFilter = useUIStore((s) => s.filterPriority);
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

  const q = query.trim().toLowerCase();
  const assigneeIds = [ticket.assignee?.id, ...(ticket.extraAssignees ?? []).map((a) => a.user.id)].filter(Boolean) as string[];
  const matchesFilters =
    (!q || ticket.title.toLowerCase().includes(q) || (ticket.description ?? "").toLowerCase().includes(q)) &&
    (priorityFilter === "all" || ticket.priority === priorityFilter) &&
    (assigneeFilter === "all" ||
      (assigneeFilter === "unassigned" ? assigneeIds.length === 0 : assigneeIds.includes(assigneeFilter)));

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
      className={`shrink-0 cursor-pointer rounded-lg select-none relative group bg-surface-elevated border border-surface-border shadow-card transition-[border-color,box-shadow] hover:border-foreground/20 focus-visible:outline-none focus-visible:shadow-ring ${
        isDragging ? "shadow-xl ring-1 ring-primary/40" : ""
      }`}
      style={{
        ...style,
        display: matchesFilters ? undefined : "none",
        opacity: isSortableDragging ? 0.35 : 1,
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
      <div className="px-3 py-2.5 flex flex-col gap-2">
        {/* Key + saving state */}
        <div className="flex items-center justify-between gap-2 h-4">
          <span className="font-mono text-[11px] text-muted-foreground">{ticket.id.slice(-6).toUpperCase()}</span>
          <span className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors">
            {isSaving ? <Loader2 size={13} className="animate-spin text-muted-foreground" /> : <MoreHorizontal size={14} />}
          </span>
        </div>

        {/* Title */}
        <p
          className={`text-[13px] leading-[1.4] font-medium pr-1 ${isDone ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {isDone && <CheckCircle2 size={12} className="inline mr-1 -mt-0.5 text-emerald-500" />}
          {ticket.title}
        </p>

        {/* Page Tracker breadcrumb (only on mirrored work items) */}
        {ticket.trackerLink && (
          <Link
            href={`/page-tracker/${ticket.trackerLink.pageId}?item=${ticket.trackerLink.workItemId}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 self-start max-w-full text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
            title="Open in Page Tracker"
          >
            <Layers size={11} className="shrink-0" />
            <span className="truncate">
              {ticket.trackerLink.pageName} › {ticket.trackerLink.workstream.charAt(0) + ticket.trackerLink.workstream.slice(1).toLowerCase()}
            </span>
          </Link>
        )}

        {/* Meta row: priority · due · labels ··· comments · assignees */}
        <div className="flex items-center gap-1.5 min-h-6">
          <span
            className="h-5 w-5 inline-flex items-center justify-center rounded border border-surface-border"
            title={`Priority: ${PRIORITY_LABEL[ticket.priority]}`}
          >
            <PriorityIcon priority={ticket.priority} size={12} />
          </span>
          {dueDateStyle && (
            <span
              className={`h-5 inline-flex items-center gap-1 px-1.5 rounded border text-[11px] whitespace-nowrap tabular-nums ${dueDateStyle.cls}`}
              title={dueDateStyle.overdue ? "Overdue" : "Due date"}
            >
              <Calendar size={11} />
              {dueDateStyle.text}
            </span>
          )}
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="h-5 inline-flex items-center gap-1.5 px-1.5 rounded border border-surface-border text-[11px] text-foreground/80 max-w-[110px]"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: label.color }} />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
          {extraLabelCount > 0 && <span className="text-[11px] text-muted-foreground">+{extraLabelCount}</span>}

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto pl-1">
            {ticket._count.comments > 0 && (
              <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground tabular-nums">
                <MessageSquare size={12} />
                {ticket._count.comments}
              </span>
            )}
            {visibleAssignees.length > 0 ? (
              <span className="flex -space-x-1.5">
                {visibleAssignees.map((u) => (
                  <Avatar key={u.id} displayName={u.displayName} avatarColor={u.avatarColor} size="sm" className="ring-2 ring-surface-elevated" />
                ))}
                {extraCount > 0 && (
                  <span className="w-6 h-6 rounded-full bg-surface-hover text-[10px] font-medium text-muted-foreground flex items-center justify-center ring-2 ring-surface-elevated">
                    +{extraCount}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/70">
                <RelativeTime date={ticket.lastActivityAt} />
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
