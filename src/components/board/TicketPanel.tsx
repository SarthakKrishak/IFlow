"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Ticket, User, Label, Column, Comment, ActivityLog } from "@prisma/client";
import { useUIStore } from "@/stores/ui.store";
import {
  updateTicket,
  assignTicket,
  deleteTicket,
  addLabel,
  removeLabel,
  moveTicket,
} from "@/server/actions/ticket.actions";
import { addComment } from "@/server/actions/comment.actions";
import { PriorityChip, DepartmentTag, Avatar, RelativeTime } from "@/components/shared";
import {
  X,
  Trash2,
  MessageSquare,
  Clock,
  Tag,
  User as UserIcon,
  Calendar,
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type TicketFull = Ticket & {
  assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  createdBy: Pick<User, "id" | "displayName" | "avatarColor">;
  labels: Pick<Label, "id" | "name" | "color">[];
  comments: (Comment & { author: Pick<User, "id" | "displayName" | "avatarColor"> })[];
  activityLogs: (ActivityLog & { user: Pick<User, "id" | "displayName"> })[];
  column: Column;
};

interface TicketPanelProps {
  ticket: TicketFull;
  allUsers: Pick<User, "id" | "displayName" | "avatarColor" | "isActive" | "role" | "lastSeenAt">[];
  allLabels: Pick<Label, "id" | "name" | "color">[];
  allColumns: Pick<Column, "id" | "name" | "order">[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MANAGER" | "MEMBER";
}

function activityToSentence(log: ActivityLog & { user: Pick<User, "id" | "displayName"> }): string {
  const name = log.user.displayName;
  switch (log.action) {
    case "CREATED": return `${name} created this ticket`;
    case "MOVED": return `${name} moved this from ${log.fromValue ?? "?"} to ${log.toValue ?? "?"}`;
    case "ASSIGNED": return log.toValue ? `${name} assigned to ${log.toValue}` : `${name} assigned this`;
    case "UNASSIGNED": return `${name} unassigned ${log.fromValue ?? "someone"}`;
    case "COMMENTED": return `${name} left a comment`;
    case "EDITED": return `${name} edited this ticket`;
    case "COMPLETED": return `${name} marked as done`;
    case "REOPENED": return `${name} moved back from ${log.fromValue ?? "Done"} to ${log.toValue ?? "?"}`;
    case "PRIORITY_CHANGED": return `${name} changed priority: ${log.fromValue ?? "?"} → ${log.toValue ?? "?"}`;
    case "DUE_DATE_CHANGED": return `${name} changed the due date`;
    case "LABEL_ADDED": return `${name} added label: ${log.toValue ?? "?"}`;
    case "LABEL_REMOVED": return `${name} removed label: ${log.fromValue ?? "?"}`;
    default: return `${name} updated this ticket`;
  }
}

export function TicketPanel({ ticket: initialTicket, allUsers, allLabels, allColumns, currentUserId, currentUserRole }: TicketPanelProps) {
  const router = useRouter();
  const { closeTicketPanel } = useUIStore();
  const [ticket, setTicket] = useState(initialTicket);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(ticket.title);
  const [descValue, setDescValue] = useState(ticket.description ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = currentUserRole === "ADMIN" || ticket.createdById === currentUserId;

  // Single refresh on panel close — not on every individual action.
  const handleClose = useCallback(() => {
    closeTicketPanel();
    router.refresh(); // One refresh when the panel closes to sync board state
  }, [closeTicketPanel, router]);

  const save = useCallback(async (changes: Parameters<typeof updateTicket>[0]["changes"]) => {
    setIsSaving(true);
    setError(null);
    const result = await updateTicket({ ticketId: ticket.id, changes });
    if (!result.success) {
      setError("Couldn't save that change — retry?");
    }
    // No router.refresh() here — local optimistic state is already updated below
    setIsSaving(false);
  }, [ticket.id]);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (titleValue.trim() !== ticket.title && titleValue.trim()) {
      setTicket((t) => ({ ...t, title: titleValue.trim() }));
      await save({ title: titleValue.trim() });
    }
  };

  const handleDescBlur = async () => {
    if (descValue !== (ticket.description ?? "")) {
      setTicket((t) => ({ ...t, description: descValue }));
      await save({ description: descValue });
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    const newAssignee = allUsers.find((u) => u.id === assigneeId) ?? null;
    // Optimistic update first — UI is instant
    setTicket((t) => ({ ...t, assigneeId: assigneeId === "none" ? null : assigneeId, assignee: newAssignee }));
    await assignTicket({ ticketId: ticket.id, assigneeId: assigneeId === "none" ? null : assigneeId });
    // No router.refresh() — board canvas will sync on panel close
  };

  const handlePriorityChange = async (priority: Ticket["priority"]) => {
    setTicket((t) => ({ ...t, priority }));
    await save({ priority });
  };

  const handleColumnChange = async (columnId: string) => {
    const newColumn = allColumns.find((c) => c.id === columnId)!;
    // Optimistic update first — UI is instant
    setTicket((t) => ({ ...t, columnId, column: newColumn as Column }));
    await moveTicket({ ticketId: ticket.id, toColumnId: columnId, toOrder: 0 });
    // No router.refresh() — board canvas will sync on panel close
  };

  const handleLabelToggle = async (labelId: string, isSelected: boolean) => {
    if (isSelected) {
      // Optimistic remove
      setTicket((t) => ({ ...t, labels: t.labels.filter((l) => l.id !== labelId) }));
      await removeLabel({ ticketId: ticket.id, labelId });
    } else {
      const newLabel = allLabels.find((l) => l.id === labelId)!;
      // Optimistic add
      setTicket((t) => ({ ...t, labels: [...t.labels, newLabel] }));
      await addLabel({ ticketId: ticket.id, labelId });
    }
    // No router.refresh() — board card label dots will sync on panel close
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setIsSubmittingComment(true);
    const result = await addComment({ ticketId: ticket.id, body: commentBody.trim() });
    if (result.success) {
      setCommentBody("");
      // Optimistic append
      const currentUser = allUsers.find((u) => u.id === currentUserId);
      if (currentUser) {
        setTicket((t) => ({
          ...t,
          comments: [
            ...t.comments,
            {
              ...result.data,
              author: { id: currentUser.id, displayName: currentUser.displayName, avatarColor: currentUser.avatarColor },
            },
          ],
        }));
      }
    }
    setIsSubmittingComment(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this ticket? This can't be undone.")) return;
    await deleteTicket({ ticketId: ticket.id });
    closeTicketPanel();
    router.refresh(); // Refresh needed after delete to remove card from board
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: "clamp(320px, 480px, 100vw)",
          background: "hsl(var(--surface-elevated))",
          borderLeft: "1px solid hsl(var(--surface-border))",
        }}
        role="dialog"
        aria-label={`Ticket: ${ticket.title}`}
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <DepartmentTag department={ticket.department} />
            <span className="font-mono text-xs text-muted-foreground">#{ticket.id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 size={14} className="animate-spin text-[#5B5FEF]" />}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded text-muted-foreground hover:text-[#D1495B] hover:bg-[#D1495B]/10 transition-all"
                aria-label="Delete ticket"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded text-muted-foreground hover:text-text-primary hover:bg-surface-border transition-all"
              aria-label="Close panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#D1495B]/10 border border-[#D1495B]/30 text-sm text-[#D1495B]">
              <AlertCircle size={14} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
            </div>
          )}

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") handleTitleBlur(); if (e.key === "Escape") { setTitleValue(ticket.title); setEditingTitle(false); } }}
              className="w-full text-xl font-semibold text-text-primary bg-transparent border-b border-[#5B5FEF] outline-none pb-1"
              aria-label="Ticket title"
            />
          ) : (
            <h1
              className="text-xl font-semibold text-text-primary cursor-text hover:text-white transition-colors leading-snug"
              onClick={() => setEditingTitle(true)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(true); }}
              role="button"
              aria-label="Click to edit title"
            >
              {ticket.title}
            </h1>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status / column */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Status</label>
              <select
                value={ticket.columnId}
                onChange={(e) => handleColumnChange(e.target.value)}
                className="w-full px-2.5 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                aria-label="Ticket status"
              >
                {allColumns.sort((a, b) => a.order - b.order).map((col) => (
                  <option key={col.id} value={col.id} style={{ background: "hsl(var(--surface-base))" }}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value as Ticket["priority"])}
                className="w-full px-2.5 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                aria-label="Ticket priority"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p} style={{ background: "hsl(var(--surface-base))" }}>{p[0] + p.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                <UserIcon size={10} className="inline mr-1" />Assignee
              </label>
              <select
                value={ticket.assigneeId ?? "none"}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full px-2.5 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                aria-label="Ticket assignee"
              >
                <option value="none" style={{ background: "hsl(var(--surface-base))" }}>Unassigned</option>
                {allUsers.filter((u) => u.isActive && u.role !== 'ADMIN').map((user) => (
                  <option key={user.id} value={user.id} style={{ background: "hsl(var(--surface-base))" }}>{user.displayName}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                <Calendar size={10} className="inline mr-1" />Due date
              </label>
              <input
                type="date"
                value={ticket.dueDate ? new Date(ticket.dueDate).toISOString().split("T")[0] : ""}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  setTicket((t) => ({ ...t, dueDate: val ? new Date(val) : null }));
                  save({ dueDate: val ? new Date(val).toISOString() : null });
                }}
                className="w-full px-2.5 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                aria-label="Due date"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
              <Tag size={10} className="inline mr-1" />Labels
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allLabels.map((label) => {
                const isSelected = ticket.labels.some((l) => l.id === label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => handleLabelToggle(label.id, isSelected)}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-all"
                    style={{
                      color: label.color,
                      background: isSelected ? `${label.color}25` : "transparent",
                      border: `1px solid ${isSelected ? label.color : label.color + "40"}`,
                      opacity: isSelected ? 1 : 0.6,
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Remove" : "Add"} label: ${label.name}`}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Description</label>
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={handleDescBlur}
              rows={4}
              placeholder="Add a description…"
              className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none resize-none placeholder-muted-foreground"
              style={{ lineHeight: "1.5" }}
              aria-label="Ticket description"
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5B5FEF")}
            />
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare size={10} />
              Comments ({ticket.comments.length})
            </h3>
            <div className="space-y-3">
              {ticket.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar
                    displayName={comment.author.displayName}
                    avatarColor={comment.author.avatarColor}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-text-primary">{comment.author.displayName}</span>
                      <RelativeTime date={comment.createdAt} />
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <div className="flex gap-3 mt-4">
              <div className="flex-1 relative">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  rows={2}
                  placeholder="Leave a comment… (Ctrl+Enter to send)"
                  className="w-full px-3 py-2 pr-10 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none resize-none placeholder-muted-foreground"
                  aria-label="Comment body"
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#5B5FEF")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(var(--surface-border))")}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentBody.trim() || isSubmittingComment}
                  className="absolute right-2 bottom-2 p-1.5 rounded text-[#5B5FEF] hover:bg-[#5B5FEF]/15 transition-all disabled:opacity-40"
                  aria-label="Post comment"
                >
                  {isSubmittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Activity timeline */}
          <div>
            <h3 className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock size={10} />
              Activity
            </h3>
            <div className="space-y-2">
              {ticket.activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface-border mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary font-mono leading-relaxed">
                      {activityToSentence(log)}
                    </p>
                    <RelativeTime date={log.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Created info */}
          <div className="pt-2 pb-4 text-xs text-muted-foreground font-mono">
            Created by {ticket.createdBy.displayName} · {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
          </div>
        </div>
      </motion.div>
    </>
  );
}
