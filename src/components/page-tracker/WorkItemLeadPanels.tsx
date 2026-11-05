"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, UserCog } from "lucide-react";
import type { Priority } from "@/lib/page-tracker/constants";
import {
  adminOverrideUpdate,
  cancelWorkItem,
  changeReviewer,
  managePlanning,
  reassignWorkItem,
  setWorkItemArchived,
} from "@/server/actions/tracker-workitem.actions";
import {
  UserSelect,
  btnDanger,
  btnGhost,
  btnPrimary,
  dateInputValue,
  inputCls,
  isoFromDateInput,
  labelCls,
  type Member,
  type Viewer,
} from "./ui";

interface ItemLite {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  notes: string | null;
  status: string;
  priority: string;
  assigneeId: string;
  reviewerId: string | null;
  dueDate: Date | null;
  isRequired: boolean;
  exclusionReason: string | null;
  archivedAt: Date | null;
}

/** Lead/Admin-controlled fields: assignee, reviewer, planning, cancel, archive. */
export function LeadControls({
  item,
  members,
  onChanged,
}: {
  item: ItemLite;
  members: Member[];
  onChanged: () => void;
}) {
  const closed = item.status === "DONE" || item.status === "CANCELLED";
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reviewerReason, setReviewerReason] = useState("");
  const [priority, setPriority] = useState(item.priority as Priority);
  const [due, setDue] = useState(dateInputValue(item.dueDate));
  const [required, setRequired] = useState(item.isRequired);
  const [exclusion, setExclusion] = useState(item.exclusionReason ?? "");
  const [cancelReason, setCancelReason] = useState("");

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, msg: string, reset?: () => void) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) return toast.error(r.error ?? "Failed");
    toast.success(msg);
    reset?.();
    onChanged();
  };

  const planningDirty =
    priority !== item.priority || due !== dateInputValue(item.dueDate) || required !== item.isRequired;

  return (
    <div className="space-y-5">
      {!closed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelCls}>Reassign owner</label>
              <UserSelect
                users={members.filter((m) => m.role !== "ADMIN")}
                value={assignee}
                onChange={setAssignee}
                exclude={[item.assigneeId, item.reviewerId]}
                emptyLabel="Choose new owner…"
              />
              <input className={inputCls} placeholder="Reason (required, recorded)" value={assignReason} maxLength={500} onChange={(e) => setAssignReason(e.target.value)} />
              <button
                className={btnGhost}
                disabled={busy || !assignee || assignReason.trim().length < 3}
                onClick={() =>
                  run(() => reassignWorkItem({ workItemId: item.id, newAssigneeId: assignee, reason: assignReason }), "Work item reassigned", () => {
                    setAssignee("");
                    setAssignReason("");
                  })
                }
              >
                <UserCog size={14} /> Reassign
              </button>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Change reviewer</label>
              <UserSelect users={members} value={reviewer} onChange={setReviewer} exclude={[item.assigneeId, item.reviewerId]} emptyLabel="Choose reviewer…" />
              <input className={inputCls} placeholder="Reason (required, recorded)" value={reviewerReason} maxLength={500} onChange={(e) => setReviewerReason(e.target.value)} />
              <button
                className={btnGhost}
                disabled={busy || !reviewer || reviewerReason.trim().length < 3}
                onClick={() =>
                  run(() => changeReviewer({ workItemId: item.id, reviewerId: reviewer, reason: reviewerReason }), "Reviewer changed", () => {
                    setReviewer("");
                    setReviewerReason("");
                  })
                }
              >
                Change reviewer
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-base p-3.5 space-y-3">
            <p className="text-[12px] font-medium text-muted-foreground">Planning</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Priority</label>
                <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Due date</label>
                <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              Required for the page completion gate
            </label>
            {!required && (
              <input className={inputCls} placeholder="Why is this optional? (required, recorded)" value={exclusion} maxLength={500} onChange={(e) => setExclusion(e.target.value)} />
            )}
            <button
              className={btnGhost}
              disabled={busy || !planningDirty || (!required && exclusion.trim().length < 3)}
              onClick={() =>
                run(
                  () =>
                    managePlanning({
                      workItemId: item.id,
                      changes: {
                        ...(priority !== item.priority && { priority }),
                        ...(due !== dateInputValue(item.dueDate) && { dueDate: isoFromDateInput(due) }),
                        ...(required !== item.isRequired && {
                          isRequired: required,
                          exclusionReason: required ? null : exclusion,
                        }),
                      },
                    }),
                  "Planning updated"
                )
              }
            >
              Save planning
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Cancel this work item</label>
              <input className={inputCls} placeholder="Reason (required, recorded)" value={cancelReason} maxLength={500} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <button
              className={btnDanger}
              disabled={busy || cancelReason.trim().length < 3}
              onClick={() => {
                if (!confirm("Cancel this work item? It will no longer count toward the page.")) return;
                run(() => cancelWorkItem({ workItemId: item.id, reason: cancelReason }), "Work item cancelled", () => setCancelReason(""));
              }}
            >
              Cancel item
            </button>
          </div>
        </>
      )}

      <div>
        <button
          className={btnGhost}
          disabled={busy}
          onClick={() =>
            run(
              () => setWorkItemArchived({ workItemId: item.id, archived: !item.archivedAt }),
              item.archivedAt ? "Restored" : "Archived"
            )
          }
        >
          {item.archivedAt ? "Restore work item" : "Archive work item"}
        </button>
      </div>
    </div>
  );
}

/** Admin-only, deliberate override. Always asks for a reason and is audited + visibly flagged. */
export function AdminOverride({
  item,
  viewer,
  onChanged,
}: {
  item: ItemLite & { blockedReason?: string | null };
  viewer: Viewer;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [f, setF] = useState({
    title: item.title,
    description: item.description ?? "",
    acceptanceCriteria: item.acceptanceCriteria ?? "",
    notes: item.notes ?? "",
    priority: item.priority as Priority,
    dueDate: dateInputValue(item.dueDate),
    status: "",
    blockedReason: "",
  });
  if (viewer.role !== "ADMIN") return null;
  if (item.status === "DONE" || item.status === "CANCELLED") return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const changes = {
      ...(f.title !== item.title && { title: f.title }),
      ...(f.description !== (item.description ?? "") && { description: f.description }),
      ...(f.acceptanceCriteria !== (item.acceptanceCriteria ?? "") && { acceptanceCriteria: f.acceptanceCriteria }),
      ...(f.notes !== (item.notes ?? "") && { notes: f.notes }),
      ...(f.priority !== item.priority && { priority: f.priority }),
      ...(f.dueDate !== dateInputValue(item.dueDate) && { dueDate: isoFromDateInput(f.dueDate) }),
      ...(f.status && {
        status: f.status as "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED",
        blockedReason: f.blockedReason,
      }),
    };
    if (Object.keys(changes).length === 0) return toast.error("Nothing to change");
    setBusy(true);
    const r = await adminOverrideUpdate({ workItemId: item.id, reason, changes });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Override applied and recorded");
    setReason("");
    setOpen(false);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <button className="flex items-center gap-2 text-[12.5px] font-semibold text-red-500" onClick={() => setOpen((v) => !v)}>
        <ShieldAlert size={15} /> Administrative override {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            This edits another person’s work item. It is not the normal way to update work — the change is recorded in the audit log with your name, the reason and a visible “admin override” flag, and the owner is notified.
          </p>
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} min-h-[60px]`} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                  <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" className={inputCls} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
          </div>
          {item.status !== "READY_FOR_REVIEW" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Force status</label>
                <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="">Keep current</option>
                  <option value="NOT_STARTED">Not started</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
              {f.status === "BLOCKED" && (
                <div>
                  <label className={labelCls}>Blocked reason</label>
                  <input className={inputCls} value={f.blockedReason} onChange={(e) => set("blockedReason", e.target.value)} />
                </div>
              )}
            </div>
          )}
          <div>
            <label className={labelCls}>Reason for override (required)</label>
            <input className={inputCls} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Owner on leave, deadline fix" />
          </div>
          <button className={btnPrimary + " !bg-red-600"} disabled={busy || reason.trim().length < 5} onClick={save}>
            {busy ? "Applying…" : "Apply override"}
          </button>
        </div>
      )}
    </div>
  );
}
