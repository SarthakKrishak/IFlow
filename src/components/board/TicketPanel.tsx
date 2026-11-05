"use client";

import { PriorityIcon, PRIORITY_LABEL, StageIcon, stageOf } from "@/components/shared/StatusGlyphs";
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Ticket, User, Label, Column, Comment, ActivityLog } from "@prisma/client";
import { useUIStore } from "@/stores/ui.store";
import { useConfirm } from "@/components/ui";
import {
  updateTicket,
  deleteTicket,
  addLabel,
  removeLabel,
  moveTicket,
} from "@/server/actions/ticket.actions";
import { setTicketAssignees } from "@/server/actions/assignee.actions";
import { createLabel } from "@/server/actions/label.actions";
import { addComment } from "@/server/actions/comment.actions";
import { Avatar, RelativeTime } from "@/components/shared";
import { MentionInput, MentionBody } from "./MentionInput";
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
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
  Flag,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AssigneeLite = Pick<User, "id" | "displayName" | "avatarColor">;

export type TicketFull = Ticket & {
  assignee: AssigneeLite | null;
  extraAssignees?: { user: AssigneeLite }[];
  createdBy: AssigneeLite;
  labels: Pick<Label, "id" | "name" | "color">[];
  comments: (Comment & { author: AssigneeLite })[];
  activityLogs: (ActivityLog & { user: Pick<User, "id" | "displayName"> })[];
  column: Column;
  board?: { id: string; name: string };
};

interface TicketPanelProps {
  ticket: TicketFull;
  allUsers: (Pick<User, "id" | "displayName" | "avatarColor" | "isActive" | "role" | "lastSeenAt"> & { username?: string })[];
  allLabels: Pick<Label, "id" | "name" | "color">[];
  allColumns: Pick<Column, "id" | "name" | "order">[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MANAGER" | "MEMBER";
}

function activityToSentence(log: ActivityLog & { user: Pick<User, "id" | "displayName"> }): string {
  const name = log.user.displayName;
  switch (log.action) {
    case "CREATED": return `${name} created this issue`;
    case "MOVED": return `${name} moved this from ${log.fromValue ?? "?"} to ${log.toValue ?? "?"}`;
    case "ASSIGNED": return log.toValue ? `${name} assigned to ${log.toValue}` : `${name} assigned this`;
    case "UNASSIGNED": return `${name} unassigned ${log.fromValue ?? "someone"}`;
    case "COMMENTED": return `${name} commented`;
    case "EDITED": return `${name} edited this issue`;
    case "COMPLETED": return `${name} marked as done`;
    case "REOPENED": return `${name} reopened (from ${log.fromValue ?? "Done"})`;
    case "PRIORITY_CHANGED": return `${name} changed priority: ${log.fromValue ?? "?"} → ${log.toValue ?? "?"}`;
    case "DUE_DATE_CHANGED": return `${name} changed the due date`;
    case "LABEL_ADDED": return `${name} added label ${log.toValue ?? "?"}`;
    case "LABEL_REMOVED": return `${name} removed label ${log.fromValue ?? "?"}`;
    default: return `${name} updated this issue`;
  }
}

const PRIORITY_STYLE: Record<Ticket["priority"], { color: string; bg: string }> = {
  LOW: { color: "#10B981", bg: "rgba(16,185,129,.12)" },
  MEDIUM: { color: "#F59E0B", bg: "rgba(245,158,11,.12)" },
  HIGH: { color: "#EF4444", bg: "rgba(239,68,68,.12)" },
  URGENT: { color: "#B91C1C", bg: "rgba(185,28,28,.14)" },
};

const LABEL_COLORS = ["#5B5FEF", "#007ACC", "#1EAE7C", "#C79A3D", "#D9713C", "#D1495B", "#9B59B6", "#EC6A52"];

/** Format a date for <input type="date"> in LOCAL time (toISOString is UTC and shifts the day for IST etc.) */
function toLocalDateInput(d: Date | string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TicketPanel({ ticket: initialTicket, allUsers, allLabels, allColumns, currentUserId, currentUserRole }: TicketPanelProps) {
  const { confirm: ask, dialog: confirmDialog } = useConfirm();
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
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelQuery, setLabelQuery] = useState("");
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [labels, setLabels] = useState(allLabels);

  // Long-lived tickets accumulate hundreds of rows — render a window and
  // let the user expand. Keeps the panel fast no matter how old a ticket gets.
  const COMMENT_PAGE = 15;
  const ACTIVITY_PAGE = 15;
  const [visibleComments, setVisibleComments] = useState(COMMENT_PAGE);
  const [visibleActivity, setVisibleActivity] = useState(ACTIVITY_PAGE);

  const canDelete = currentUserRole === "ADMIN" || ticket.createdById === currentUserId;
  const issueKey = ticket.id.slice(-6).toUpperCase();
  const memberUsers = useMemo(() => allUsers.filter((u) => u.isActive && u.role !== "ADMIN"), [allUsers]);

  // Combined assignees (primary first, deduped)
  const assignees: AssigneeLite[] = useMemo(() => {
    const list: AssigneeLite[] = [];
    if (ticket.assignee) list.push(ticket.assignee);
    (ticket.extraAssignees ?? []).forEach((a) => {
      if (!list.some((x) => x.id === a.user.id)) list.push(a.user);
    });
    return list;
  }, [ticket.assignee, ticket.extraAssignees]);

  const handleClose = useCallback(() => {
    closeTicketPanel();
    router.refresh();
  }, [closeTicketPanel, router]);

  const save = useCallback(async (changes: Parameters<typeof updateTicket>[0]["changes"]) => {
    setIsSaving(true);
    setError(null);
    const result = await updateTicket({ ticketId: ticket.id, changes });
    if (!result.success) setError("Couldn't save that change — retry?");
    setIsSaving(false);
  }, [ticket.id]);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (titleValue.trim() !== ticket.title && titleValue.trim()) {
      setTicket((t) => ({ ...t, title: titleValue.trim() }));
      await save({ title: titleValue.trim() });
    } else {
      setTitleValue(ticket.title);
    }
  };

  const handleDescBlur = async () => {
    if (descValue !== (ticket.description ?? "")) {
      setTicket((t) => ({ ...t, description: descValue }));
      await save({ description: descValue });
    }
  };

  const handleAssigneeToggle = async (userId: string) => {
    const has = assignees.some((a) => a.id === userId);
    const nextIds = has ? assignees.filter((a) => a.id !== userId).map((a) => a.id) : [...assignees.map((a) => a.id), userId];
    const nextUsers = nextIds
      .map((id) => memberUsers.find((u) => u.id === id))
      .filter(Boolean) as AssigneeLite[];
    const primary = nextUsers[0] ?? null;
    setTicket((t) => ({
      ...t,
      assigneeId: primary?.id ?? null,
      assignee: primary,
      extraAssignees: nextUsers.slice(1).map((user) => ({ user })),
    }));
    const result = await setTicketAssignees({ ticketId: ticket.id, assigneeIds: nextIds });
    if (!result.success) setError("Couldn't update assignees — retry?");
  };

  const handlePriorityChange = async (priority: Ticket["priority"]) => {
    setTicket((t) => ({ ...t, priority }));
    await save({ priority });
  };

  const handleColumnChange = async (columnId: string) => {
    const newColumn = allColumns.find((c) => c.id === columnId)!;
    setTicket((t) => ({ ...t, columnId, column: newColumn as Column }));
    await moveTicket({ ticketId: ticket.id, toColumnId: columnId, toOrder: 0 });
  };

  const handleLabelToggle = async (labelId: string, isSelected: boolean) => {
    if (isSelected) {
      setTicket((t) => ({ ...t, labels: t.labels.filter((l) => l.id !== labelId) }));
      await removeLabel({ ticketId: ticket.id, labelId });
    } else {
      const newLabel = labels.find((l) => l.id === labelId)!;
      setTicket((t) => ({ ...t, labels: [...t.labels, newLabel] }));
      await addLabel({ ticketId: ticket.id, labelId });
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    setCreatingLabel(true);
    const result = await createLabel({ name: newLabelName.trim(), color: newLabelColor });
    setCreatingLabel(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (!labels.some((l) => l.id === result.data.id)) setLabels((prev) => [...prev, result.data]);
    if (!ticket.labels.some((l) => l.id === result.data.id)) {
      setTicket((t) => ({ ...t, labels: [...t.labels, result.data] }));
      await addLabel({ ticketId: ticket.id, labelId: result.data.id });
    }
    setNewLabelName("");
    setShowNewLabel(false);
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setIsSubmittingComment(true);
    const result = await addComment({ ticketId: ticket.id, body: commentBody.trim() });
    if (result.success) {
      setCommentBody("");
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
      setTab("comments");
    } else {
      setError("Couldn't post that comment — retry?");
    }
    setIsSubmittingComment(false);
  };

  const handleDelete = async () => {
    if (!(await ask({ title: "Delete this issue?", description: "Its comments and history will be permanently removed.", confirmLabel: "Delete issue", danger: true }))) return;
    const res = await deleteTicket({ ticketId: ticket.id });
    if (!res.success) {
      setError(res.error);
      return;
    }
    closeTicketPanel();
    router.refresh();
  };

  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(labelQuery.toLowerCase())
  );

  const sortedColumns = useMemo(() => [...allColumns].sort((a, b) => a.order - b.order), [allColumns]);
  const shownComments = ticket.comments.slice(-visibleComments);
  const hiddenCommentCount = ticket.comments.length - shownComments.length;
  const activityNewestFirst = useMemo(() => [...ticket.activityLogs].reverse(), [ticket.activityLogs]);
  const shownActivity = activityNewestFirst.slice(0, visibleActivity);
  const pr = PRIORITY_STYLE[ticket.priority];

  return (
    <>
      {confirmDialog}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} aria-hidden="true" />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden shadow-2xl bg-surface-elevated border-l border-surface-border"
        style={{ width: "min(880px, 100vw)" }}
        role="dialog"
        aria-label={`Issue: ${ticket.title}`}
        aria-modal="true"
      >
        {/* Top bar: breadcrumb + actions */}
        <div className="h-12 shrink-0 px-5 flex items-center justify-between gap-2 border-b border-surface-border">
          <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground min-w-0" aria-label="Breadcrumb">
            <span className="truncate">{ticket.board?.name ?? "Board"}</span>
            <ChevronRight size={13} className="opacity-60 shrink-0" />
            <span className="font-mono text-foreground">{issueKey}</span>
            {isSaving && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-[12px]">
                <Loader2 size={12} className="animate-spin" /> Saving
              </span>
            )}
          </nav>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {canDelete && (
              <button onClick={handleDelete} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors" aria-label="Delete issue" title="Delete issue">
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={handleClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors" aria-label="Close panel" title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[12.5px] text-red-500">
            <AlertCircle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-[11px] underline">Dismiss</button>
          </div>
        )}

        {/* Body: main + details sidebar */}
        <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden">
          <div className="sm:h-full grid sm:grid-cols-[minmax(0,1fr)_264px]">
            {/* Document column */}
            <div className="space-y-8 min-w-0 px-6 sm:px-8 py-6 sm:overflow-y-auto">
              {/* Title */}
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") handleTitleBlur(); if (e.key === "Escape") { setTitleValue(ticket.title); setEditingTitle(false); } }}
                  className="w-full text-[22px] font-semibold tracking-[-0.02em] leading-snug text-foreground bg-transparent outline-none rounded-md px-1.5 -mx-1.5 py-0.5 ring-1 ring-primary/50"
                  aria-label="Issue title"
                />
              ) : (
                <h1
                  className="text-[22px] font-semibold tracking-[-0.02em] text-foreground cursor-text hover:bg-surface-hover/70 rounded-md px-1.5 -mx-1.5 py-0.5 transition-colors leading-snug"
                  onClick={() => setEditingTitle(true)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(true); }}
                  role="button"
                  aria-label="Click to edit title"
                  title="Click to edit"
                >
                  {ticket.title}
                </h1>
              )}


              {/* Description */}
              <section className="-mt-4">
                <textarea
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={handleDescBlur}
                  rows={4}
                  placeholder="Add a description…"
                  className="w-full px-1.5 -mx-1.5 py-1.5 rounded-md text-[14px] text-foreground/90 bg-transparent border border-transparent outline-none resize-y placeholder:text-muted-foreground/60 hover:bg-surface-hover/50 focus:bg-transparent focus:border-surface-border transition-colors leading-relaxed min-h-[96px]"
                  aria-label="Issue description"
                />
              </section>

              {/* Comments / Activity tabs */}
              <section>
                <div className="flex items-center gap-5 border-b border-surface-border mb-4">
                  <button
                    onClick={() => setTab("comments")}
                    className={`flex items-center gap-1.5 h-9 text-[13px] font-medium border-b-[1.5px] -mb-px transition-colors ${
                      tab === "comments" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquare size={13} />
                    Comments ({ticket.comments.length})
                  </button>
                  <button
                    onClick={() => setTab("activity")}
                    className={`flex items-center gap-1.5 h-9 text-[13px] font-medium border-b-[1.5px] -mb-px transition-colors ${
                      tab === "activity" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clock size={13} />
                    Activity ({ticket.activityLogs.length})
                  </button>
                </div>

                {tab === "comments" ? (
                  <>
                    <div className="space-y-4">
                      {ticket.comments.length === 0 && (
                        <p className="text-[12.5px] text-muted-foreground/70 py-1">No comments yet — start the discussion.</p>
                      )}
                      {hiddenCommentCount > 0 && (
                        <button
                          onClick={() => setVisibleComments((v) => v + COMMENT_PAGE)}
                          className="text-[12px] font-semibold text-primary hover:underline"
                        >
                          Show {Math.min(COMMENT_PAGE, hiddenCommentCount)} older comments ({hiddenCommentCount} hidden)
                        </button>
                      )}
                      {shownComments.map((comment) => (
                        <div key={comment.id} className="flex gap-2.5">
                          <Avatar displayName={comment.author.displayName} avatarColor={comment.author.avatarColor} size="sm" />
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-baseline gap-2 mb-0.5 text-[12px] text-muted-foreground">
                              <span className="text-[13px] font-medium text-foreground">{comment.author.displayName}</span>
                              <RelativeTime date={comment.createdAt} />
                            </div>
                            <MentionBody body={comment.body} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2.5 mt-4">
                      <div className="flex-1 min-w-0">
                        <MentionInput
                          value={commentBody}
                          onChange={setCommentBody}
                          onSubmit={handleAddComment}
                          members={allUsers}
                          submitting={isSubmittingComment}
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={handleAddComment}
                            disabled={!commentBody.trim() || isSubmittingComment}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
                            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                          >
                            {isSubmittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                            {isSubmittingComment ? "Posting…" : "Comment"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <ol className="relative border-l border-surface-border ml-1.5 space-y-3 pl-4 py-1">
                    {ticket.activityLogs.length === 0 && (
                      <p className="text-[12.5px] text-muted-foreground/70">No activity yet.</p>
                    )}
                    {shownActivity.map((log) => (
                      <li key={log.id} className="relative">
                        <span className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-surface-elevated ring-1 ring-muted-foreground/50" />
                        <p className="text-[12px] text-foreground/85 leading-snug">{activityToSentence(log)}</p>
                        <RelativeTime date={log.createdAt} />
                      </li>
                    ))}
                    {shownActivity.length < ticket.activityLogs.length && (
                      <button
                        onClick={() => setVisibleActivity((v) => v + ACTIVITY_PAGE)}
                        className="text-[12px] font-semibold text-primary hover:underline mt-1"
                      >
                        Show older activity ({ticket.activityLogs.length - shownActivity.length} more)
                      </button>
                    )}
                  </ol>
                )}
              </section>
            </div>

            {/* Details sidebar */}
            <aside className="bg-surface-base border-t sm:border-t-0 sm:border-l border-surface-border px-5 py-5 space-y-5 sm:overflow-y-auto">
              <PropRow label="Status">
                <span className="relative flex items-center">
                  <span className="absolute left-2 pointer-events-none">
                    <StageIcon stage={stageOf(sortedColumns.find((c) => c.id === ticket.columnId)?.name ?? "")} />
                  </span>
                  <select
                    value={ticket.columnId}
                    onChange={(e) => handleColumnChange(e.target.value)}
                    className="w-full appearance-none h-8 pl-7 pr-7 rounded-md text-[13px] text-foreground bg-transparent hover:bg-surface-hover border border-transparent hover:border-surface-border outline-none cursor-pointer transition-colors focus-visible:border-primary/60"
                    aria-label="Issue status"
                  >
                    {sortedColumns.map((col) => (
                      <option key={col.id} value={col.id} style={{ background: "hsl(var(--surface-elevated))" }}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 pointer-events-none text-muted-foreground" />
                </span>
              </PropRow>

              <PropRow label="Priority">
                <span className="relative flex items-center">
                  <span className="absolute left-2 pointer-events-none">
                    <PriorityIcon priority={ticket.priority} size={13} />
                  </span>
                  <select
                    value={ticket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as Ticket["priority"])}
                    className="w-full appearance-none h-8 pl-7 pr-7 rounded-md text-[13px] text-foreground bg-transparent hover:bg-surface-hover border border-transparent hover:border-surface-border outline-none cursor-pointer transition-colors focus-visible:border-primary/60"
                    aria-label="Issue priority"
                  >
                    {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                      <option key={p} value={p} style={{ background: "hsl(var(--surface-elevated))" }}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 pointer-events-none text-muted-foreground" />
                </span>
              </PropRow>

              <div className="h-px bg-surface-border" />

              {/* Assignees (multi) */}
              <div className="relative">
                <h2 className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  Assignees
                </h2>
                {assignees.length > 0 ? (
                  <div className="space-y-1.5 mb-2">
                    {assignees.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-2 group/a">
                        <Avatar displayName={a.displayName} avatarColor={a.avatarColor} size="sm" />
                        <span className="text-[12.5px] font-medium text-foreground truncate flex-1">{a.displayName}</span>
                        {i === 0 && assignees.length > 1 && <span className="text-[11px] text-muted-foreground">Primary</span>}
                        <button
                          onClick={() => handleAssigneeToggle(a.id)}
                          className="opacity-0 group-hover/a:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-red-500 transition-all text-sm leading-none px-1"
                          aria-label={`Remove ${a.displayName}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/70 mb-2">Unassigned</p>
                )}
                <button
                  onClick={() => setAssigneeOpen(!assigneeOpen)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus size={13} /> {assignees.length > 0 ? "Add / remove" : "Assign"}
                </button>
                {assigneeOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setAssigneeOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute left-0 top-full mt-1.5 w-60 max-h-64 overflow-y-auto bg-surface-elevated border border-surface-border rounded-lg shadow-pop z-30 p-1.5">
                    {memberUsers.map((u) => {
                      const checked = assignees.some((a) => a.id === u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleAssigneeToggle(u.id)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left"
                          aria-pressed={checked}
                        >
                          <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-surface-border"}`}>
                            {checked && <Check size={11} strokeWidth={3.5} />}
                          </span>
                          <Avatar displayName={u.displayName} avatarColor={u.avatarColor} size="sm" />
                          <span className="text-[12.5px] font-medium text-foreground truncate">{u.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              {/* Labels + custom */}
              <div>
                <h2 className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  Labels
                </h2>
                <input
                  value={labelQuery}
                  onChange={(e) => setLabelQuery(e.target.value)}
                  placeholder="Search labels…"
                  className="w-full h-8 px-2.5 mb-2 rounded-md text-[12.5px] bg-surface-elevated border border-surface-border outline-none focus:border-primary/60 placeholder:text-muted-foreground/60"
                  aria-label="Search labels"
                />
                <div className="flex flex-wrap gap-1.5">
                  {filteredLabels.map((label) => {
                    const selected = ticket.labels.some((l) => l.id === label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => handleLabelToggle(label.id, selected)}
                        className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] transition-colors border ${
                          selected ? "border-foreground/25 bg-surface-elevated text-foreground" : "border-surface-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: label.color }} />
                        {label.name}
                        {selected && <Check size={11} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
                {!showNewLabel ? (
                  <button
                    onClick={() => setShowNewLabel(true)}
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus size={13} /> Add custom label
                  </button>
                ) : (
                  <div className="mt-2 p-2.5 rounded-lg bg-surface-base border border-surface-border space-y-2">
                    <input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Label name…"
                      maxLength={30}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[12px] bg-surface-elevated border border-surface-border outline-none focus:border-primary/60"
                      aria-label="New label name"
                    />
                    <div className="flex items-center gap-1.5">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className={`w-5 h-5 rounded-full ring-offset-2 ring-offset-transparent transition-all ${newLabelColor === c ? "ring-2 ring-primary scale-110" : ""}`}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateLabel}
                        disabled={!newLabelName.trim() || creatingLabel}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11.5px] font-semibold text-white disabled:opacity-40"
                        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                      >
                        {creatingLabel ? "Adding…" : "Add label"}
                      </button>
                      <button
                        onClick={() => { setShowNewLabel(false); setNewLabelName(""); }}
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Due date */}
              <div>
                <h2 className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  Due date
                </h2>
                <input
                  type="date"
                  value={ticket.dueDate ? toLocalDateInput(ticket.dueDate) : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Noon local time: immune to UTC day-shifts in either direction
                    const asDate = val ? new Date(`${val}T12:00:00`) : null;
                    setTicket((t) => ({ ...t, dueDate: asDate }));
                    save({ dueDate: val ? asDate!.toISOString() : null });
                  }}
                  className="w-full h-8 px-2.5 rounded-md text-[12.5px] text-foreground bg-surface-elevated border border-surface-border outline-none focus:border-primary/60"
                  aria-label="Due date"
                />
              </div>

              {/* Reporter */}
              <div>
                <h2 className="text-[12px] text-muted-foreground mb-2">Reporter</h2>
                <div className="flex items-center gap-2">
                  <Avatar displayName={ticket.createdBy.displayName} avatarColor={ticket.createdBy.avatarColor} size="sm" />
                  <span className="text-[12.5px] font-medium text-foreground">{ticket.createdBy.displayName}</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-2">
                  Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
