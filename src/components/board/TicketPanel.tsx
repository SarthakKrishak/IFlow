"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Ticket, User, Label, Column, Comment, ActivityLog } from "@prisma/client";
import { useUIStore } from "@/stores/ui.store";
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
    if (!confirm("Delete this issue? This can't be undone.")) return;
    await deleteTicket({ ticketId: ticket.id });
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
      <div className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} aria-hidden="true" />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden shadow-2xl bg-surface-elevated border-l border-surface-border"
        style={{ width: "clamp(360px, 600px, 100vw)" }}
        role="dialog"
        aria-label={`Issue: ${ticket.title}`}
        aria-modal="true"
      >
        {/* Jira-style header: breadcrumb + key + actions */}
        <div className="px-5 pt-4 pb-3 border-b border-surface-border">
          <div className="flex items-center justify-between gap-2">
            <nav className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground min-w-0" aria-label="Breadcrumb">
              <span className="truncate">{ticket.board?.name ?? "Board"}</span>
              <span className="opacity-50">/</span>
              <span className="font-mono font-bold text-foreground">{issueKey}</span>
              {isSaving && <Loader2 size={12} className="animate-spin text-primary ml-1" />}
            </nav>
            <div className="flex items-center gap-1 flex-shrink-0">
              {canDelete && (
                <button onClick={handleDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all" aria-label="Delete issue">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-base transition-all" aria-label="Close panel">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => { if (e.key === "Enter") handleTitleBlur(); if (e.key === "Escape") { setTitleValue(ticket.title); setEditingTitle(false); } }}
              className="w-full mt-2 text-xl font-bold text-foreground bg-transparent border-b-2 border-primary outline-none pb-1"
              aria-label="Issue title"
            />
          ) : (
            <h1
              className="mt-2 text-xl font-bold text-foreground cursor-text hover:bg-surface-base rounded-lg px-1 -mx-1 py-0.5 transition-colors leading-snug"
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

          {/* Status + priority lozenges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="relative inline-flex items-center">
              <select
                value={ticket.columnId}
                onChange={(e) => handleColumnChange(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 outline-none cursor-pointer hover:bg-blue-500/20 transition-colors"
                aria-label="Issue status"
              >
                {sortedColumns.map((col) => (
                  <option key={col.id} value={col.id} style={{ background: "hsl(var(--surface-elevated))" }}>
                    {col.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 pointer-events-none text-blue-500" />
            </span>
            <span className="relative inline-flex items-center">
              <Flag size={11} className="absolute left-2.5 pointer-events-none" style={{ color: pr.color }} />
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value as Ticket["priority"])}
                className="appearance-none pl-7 pr-7 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border outline-none cursor-pointer transition-colors"
                style={{ color: pr.color, background: pr.bg, borderColor: `${pr.color}40` }}
                aria-label="Issue priority"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p} style={{ background: "hsl(var(--surface-elevated))" }}>{p}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 pointer-events-none" style={{ color: pr.color }} />
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-[12.5px] text-red-500">
            <AlertCircle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-[11px] underline">Dismiss</button>
          </div>
        )}

        {/* Body: main + details sidebar */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid sm:grid-cols-[minmax(0,1fr)_220px] gap-5 px-5 py-4">
            {/* Main column */}
            <div className="space-y-6 min-w-0">
              {/* Description */}
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</h2>
                <textarea
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={handleDescBlur}
                  rows={4}
                  placeholder="Add a description… (supports @mentions in comments)"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-foreground bg-surface-base border border-surface-border outline-none resize-y placeholder:text-muted-foreground/60 focus:border-primary/60 transition-colors leading-relaxed"
                  aria-label="Issue description"
                />
              </section>

              {/* Comments / Activity tabs */}
              <section>
                <div className="flex items-center gap-1 border-b border-surface-border mb-3">
                  <button
                    onClick={() => setTab("comments")}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-bold border-b-2 -mb-px transition-colors ${
                      tab === "comments" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquare size={13} />
                    Comments ({ticket.comments.length})
                  </button>
                  <button
                    onClick={() => setTab("activity")}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-bold border-b-2 -mb-px transition-colors ${
                      tab === "activity" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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
                          <div className="flex-1 min-w-0 bg-surface-base border border-surface-border rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[12px] font-bold text-foreground">{comment.author.displayName}</span>
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
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40"
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
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-surface-elevated border-2 border-primary/60" />
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
            <aside className="space-y-5 sm:border-l sm:border-surface-border sm:pl-5">
              {/* Assignees (multi) */}
              <div className="relative">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserIcon size={11} /> Assignees ({assignees.length})
                </h2>
                {assignees.length > 0 ? (
                  <div className="space-y-1.5 mb-2">
                    {assignees.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-2 group/a">
                        <Avatar displayName={a.displayName} avatarColor={a.avatarColor} size="sm" />
                        <span className="text-[12.5px] font-medium text-foreground truncate flex-1">{a.displayName}</span>
                        {i === 0 && <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Primary</span>}
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
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors"
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
                    <div className="absolute left-0 top-full mt-1.5 w-60 max-h-64 overflow-y-auto bg-surface-elevated border border-surface-border rounded-xl shadow-xl z-30 p-1.5">
                    {memberUsers.map((u) => {
                      const checked = assignees.some((a) => a.id === u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleAssigneeToggle(u.id)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-base transition-colors text-left"
                          aria-pressed={checked}
                        >
                          <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary text-white" : "border-surface-border"}`}>
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
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Tag size={11} /> Labels
                </h2>
                <input
                  value={labelQuery}
                  onChange={(e) => setLabelQuery(e.target.value)}
                  placeholder="Search labels…"
                  className="w-full px-2.5 py-1.5 mb-2 rounded-lg text-[12px] bg-surface-base border border-surface-border outline-none focus:border-primary/60 placeholder:text-muted-foreground/60"
                  aria-label="Search labels"
                />
                <div className="flex flex-wrap gap-1.5">
                  {filteredLabels.map((label) => {
                    const selected = ticket.labels.some((l) => l.id === label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => handleLabelToggle(label.id, selected)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all border"
                        style={{
                          color: selected ? "#fff" : label.color,
                          background: selected ? label.color : `${label.color}14`,
                          borderColor: selected ? label.color : `${label.color}40`,
                        }}
                        aria-pressed={selected}
                      >
                        {selected && <Check size={10} strokeWidth={3.5} />}
                        {label.name}
                      </button>
                    );
                  })}
                </div>
                {!showNewLabel ? (
                  <button
                    onClick={() => setShowNewLabel(true)}
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus size={13} /> Add custom label
                  </button>
                ) : (
                  <div className="mt-2 p-2.5 rounded-xl bg-surface-base border border-surface-border space-y-2">
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
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11.5px] font-bold text-white disabled:opacity-40"
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
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> Due date
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
                  className="w-full px-2.5 py-2 rounded-xl text-[12.5px] text-foreground bg-surface-base border border-surface-border outline-none focus:border-primary/60"
                  aria-label="Due date"
                />
              </div>

              {/* Reporter */}
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Reporter</h2>
                <div className="flex items-center gap-2">
                  <Avatar displayName={ticket.createdBy.displayName} avatarColor={ticket.createdBy.avatarColor} size="sm" />
                  <span className="text-[12.5px] font-medium text-foreground">{ticket.createdBy.displayName}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-2">
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
