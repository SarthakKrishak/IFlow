"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  X,
  Lock,
  Save,
  Send,
  Play,
  Ban,
  Plus,
  Trash2,
  CheckCircle2,
  MessageSquareWarning,
  Kanban,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  ACTION_LABEL,
  EVIDENCE_LABEL,
  EVIDENCE_TYPES,
  REQUIRED_EVIDENCE,
  WORKSTREAM_COLOR,
  WORKSTREAM_LABEL,
  type EvidenceEntry,
  type EvidenceType,
  type WorkItemStatus,
  type Workstream,
} from "@/lib/page-tracker/constants";
import {
  canEditWorkItem,
  canReview,
  canSubmit,
  isSafeHttpUrl,
  validateSubmission,
  validateTestingApproval,
  type TestCaseLike,
} from "@/lib/page-tracker/policy";
import {
  acknowledgeOwnership,
  addWorkItemComment,
  changeWorkItemStatus,
  submitWorkItem,
  updateWorkItem,
} from "@/server/actions/tracker-workitem.actions";
import { approveSubmission, requestChanges } from "@/server/actions/tracker-review.actions";
import { getWorkItemDetail, type WorkItemDetail } from "@/server/actions/tracker-read.actions";
import {
  Pill,
  PriorityBadge,
  SafeLink,
  StatusBadge,
  UserChip,
  UserDot,
  btnDanger,
  btnGhost,
  btnPrimary,
  dateInputValue,
  fmtDate,
  fmtDateTime,
  inputCls,
  isLeadRole,
  isOverdue,
  isoFromDateInput,
  labelCls,
  type Member,
  type Viewer,
} from "./ui";
import { TestCasesPanel } from "./TestCasesPanel";
import { LeadControls, AdminOverride } from "./WorkItemLeadPanels";
import { BugCard, type BugRow } from "./BugComponents";

interface LinkRow {
  label: string;
  url: string;
}
interface FormState {
  title: string;
  description: string;
  acceptanceCriteria: string;
  notes: string;
  dueDate: string;
  links: LinkRow[];
  evidence: EvidenceEntry[];
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function formFromItem(item: WorkItemDetail["item"]): FormState {
  return {
    title: item.title,
    description: item.description ?? "",
    acceptanceCriteria: item.acceptanceCriteria ?? "",
    notes: item.notes ?? "",
    dueDate: dateInputValue(item.dueDate),
    links: asArray<LinkRow>(item.links).map((l) => ({ label: l.label ?? "", url: l.url })),
    evidence: asArray<EvidenceEntry>(item.evidence),
  };
}

function Section({
  title,
  children,
  right,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`text-[12px] font-medium ${tone === "danger" ? "text-red-500" : "text-muted-foreground"}`}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function WorkItemDrawer({
  itemId,
  viewer,
  members,
  devItems,
  onClose,
  onChanged,
}: {
  itemId: string;
  viewer: Viewer;
  members: Member[];
  devItems: { id: string; title: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<WorkItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const baseline = useRef<string>("");
  const formRef = useRef<FormState | null>(null);
  formRef.current = form;
  const [summary, setSummary] = useState("");
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [comment, setComment] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [exception, setException] = useState("");
  const lead = isLeadRole(viewer);

  const load = useCallback(async () => {
    const r = await getWorkItemDetail({ workItemId: itemId });
    if (!r.success) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
    // Re-sync the form from the server, but never overwrite unsaved edits.
    const next = formFromItem(r.data.item);
    const wasDirty = !!formRef.current && JSON.stringify(formRef.current) !== baseline.current;
    baseline.current = JSON.stringify(next);
    if (!wasDirty) setForm(next);
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Refresh the drawer and the page behind it concurrently.
  const reload = useCallback(async () => {
    onChanged();
    await load();
  }, [load, onChanged]);

  const shell = (body: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-label="Work item"
        className="w-full sm:max-w-[760px] h-full bg-surface-elevated border-l border-surface-border shadow-2xl flex flex-col"
      >
        {body}
      </aside>
    </div>
  );

  if (error)
    return shell(
      <div className="p-8 text-center space-y-3">
        <p className="text-[13px] text-red-500">{error}</p>
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
    );
  if (!data || !form)
    return shell(
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );

  const { item, audits } = data;
  const status = item.status as WorkItemStatus;
  const workstream = item.workstream as Workstream;
  const isOwner = item.assigneeId === viewer.id;
  const edit = canEditWorkItem(viewer, item);
  const canEdit = edit.ok;
  const currentSub = item.submissions.find((s) => s.id === item.currentSubmissionId) ?? null;
  const reviewDecision = currentSub
    ? canReview(viewer, item, { id: currentSub.id, submittedById: currentSub.submittedById, status: currentSub.status })
    : null;
  const dirty = JSON.stringify(form) !== baseline.current;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => (p ? { ...p, [k]: v } : p));

  const run = async <T,>(fn: () => Promise<{ success: boolean; error?: string; data?: T }>, ok?: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Something went wrong");
      await load(); // stale? show the newest version
      return null;
    }
    if (ok) toast.success(ok);
    await reload();
    return r;
  };

  const save = async () => {
    const changes: Record<string, unknown> = {};
    const base = JSON.parse(baseline.current) as FormState;
    if (form.title !== base.title) changes.title = form.title;
    if (form.description !== base.description) changes.description = form.description;
    if (form.acceptanceCriteria !== base.acceptanceCriteria) changes.acceptanceCriteria = form.acceptanceCriteria;
    if (form.notes !== base.notes) changes.notes = form.notes;
    if (form.dueDate !== base.dueDate) changes.dueDate = isoFromDateInput(form.dueDate);
    if (JSON.stringify(form.links) !== JSON.stringify(base.links))
      changes.links = form.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() }));
    if (JSON.stringify(form.evidence) !== JSON.stringify(base.evidence))
      changes.evidence = form.evidence.filter((e) => e.url.trim()).map((e) => ({ type: e.type, url: e.url.trim(), ...(e.label ? { label: e.label } : {}) }));
    if (Object.keys(changes).length === 0) return;
    // Unsaved-form baseline is cleared on success by load(); on failure edits are kept.
    setBusy(true);
    const r = await updateWorkItem({ workItemId: item.id, expectedVersion: item.version, changes });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Saved");
    baseline.current = JSON.stringify(form); // saved == current form
    await reload();
  };

  const changeStatus = (to: WorkItemStatus, reason?: string) =>
    run(() => changeWorkItemStatus({ workItemId: item.id, expectedVersion: item.version, to, reason: reason ?? null }), undefined);

  // Live submission checklist (the server re-validates everything).
  const savedEvidence = asArray<EvidenceEntry>(item.evidence);
  const problems = validateSubmission({
    workstream,
    summary: summary || "ok",
    evidence: savedEvidence,
    testCases: item.testCases,
  }).filter((p) => !(summary === "" && p.startsWith("Add a short summary")));
  const submitAllowed = canEdit && canSubmit(item).ok;

  const submit = async () => {
    setSubmitErrors([]);
    setBusy(true);
    const r = await submitWorkItem({ workItemId: item.id, expectedVersion: item.version, summary });
    setBusy(false);
    if (!r.success) {
      setSubmitErrors(r.error.split("\n"));
      await load();
      return;
    }
    toast.success(r.data.status === "DONE" ? "Submitted and completed" : "Submitted for review");
    setSummary("");
    await reload();
  };

  // Review decision preview for testing items.
  const snapshot = (Array.isArray(currentSub?.testResults) ? currentSub!.testResults : []) as unknown as TestCaseLike[];
  const gate = workstream === "TESTING" && currentSub ? validateTestingApproval(viewer, snapshot, exception || null) : { ok: true as const };
  const failingMandatory = snapshot.filter((t) => t.isMandatory && t.result !== "PASS");

  const openBugCaseIds = new Set(
    item.testBugs.filter((b) => b.testCaseId && !["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"].includes(b.status)).map((b) => b.testCaseId!)
  );
  const allBugs = [...item.testBugs, ...item.devBugs.filter((b) => !item.testBugs.some((t) => t.id === b.id))];
  const overdue = isOverdue(item.dueDate, status);

  return shell(
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-border shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11.5px] text-muted-foreground flex flex-wrap items-center gap-1.5">
              <Link href={`/page-tracker/${item.page.id}`} className="hover:text-primary">{item.page.name}</Link>
              <span>›</span>
              <span className="font-semibold" style={{ color: WORKSTREAM_COLOR[workstream] }}>{WORKSTREAM_LABEL[workstream]}</span>
            </p>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground leading-snug mt-0.5">{item.title}</h2>
          </div>
          <button className="text-muted-foreground hover:text-foreground p-1 shrink-0" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <PriorityBadge priority={item.priority as never} />
          {!item.isRequired && <Pill color="#9AA1AE" title={item.exclusionReason ?? undefined}>Optional</Pill>}
          {item.archivedAt && <Pill color="#6B7280">Archived</Pill>}
          <span className={`text-[12px] ${overdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
            Due {fmtDate(item.dueDate)}{overdue ? " · overdue" : ""}
          </span>
          {item.ticket && (
            <Link href={`/board/${item.ticket.boardId}?ticket=${item.ticket.id}`} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Kanban size={12} /> {item.ticket.board.name} · {item.ticket.column.name}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-2">Owner: <UserChip user={item.assignee} /></span>
          <span className="flex items-center gap-2">Reviewer: <UserChip user={item.reviewer} empty={item.requiresReview ? "none yet" : "not required"} /></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-7">
        {/* Ownership notices */}
        {isOwner && !item.ownerAcknowledged && !item.archivedAt && status !== "DONE" && status !== "CANCELLED" && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12.5px]">
              <p className="font-semibold text-foreground">This work item was reassigned to you</p>
              <p className="text-muted-foreground mt-0.5">Review the history and current state, then acknowledge ownership to continue.</p>
            </div>
            <button className={btnPrimary} disabled={busy} onClick={() => run(() => acknowledgeOwnership({ workItemId: item.id }), "You now own this item")}>
              <ShieldCheck size={14} /> Acknowledge ownership
            </button>
          </div>
        )}
        {!isOwner && (
          <div className="rounded-xl border border-surface-border bg-surface-base px-4 py-2.5 text-[12.5px] text-muted-foreground flex items-center gap-2">
            <Lock size={13} /> Read-only — only <b className="text-foreground">{item.assignee.displayName}</b> can edit this work item.
            {reviewDecision?.ok && <span className="ml-1">You can review it below.</span>}
          </div>
        )}
        {isOwner && !canEdit && edit.ok === false && item.ownerAcknowledged && (
          <div className="rounded-xl border border-surface-border bg-surface-base px-4 py-2.5 text-[12.5px] text-muted-foreground flex items-center gap-2">
            <Eye size={13} /> {edit.error}
          </div>
        )}
        {status === "BLOCKED" && item.blockedReason && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[12.5px] text-red-500">
            <b>Blocked:</b> {item.blockedReason}
          </div>
        )}
        {status === "CANCELLED" && item.cancelledReason && (
          <div className="rounded-xl border border-surface-border bg-surface-base px-4 py-2.5 text-[12.5px] text-muted-foreground">
            <b>Cancelled:</b> {item.cancelledReason}
          </div>
        )}

        {/* Review panel */}
        {currentSub && status === "READY_FOR_REVIEW" && reviewDecision?.ok && (
          <Section title="Your review">
            <div className="rounded-xl border border-purple-500/40 bg-purple-500/5 p-4 space-y-3">
              <p className="text-[12.5px] text-muted-foreground">
                Reviewing <b className="text-foreground">submission #{currentSub.submissionNumber}</b> from {currentSub.submittedBy.displayName}. You can approve or request changes — you cannot edit their work.
              </p>
              <p className="text-[12.5px] whitespace-pre-wrap text-foreground/90 bg-surface-base rounded-lg p-3 border border-surface-border">{currentSub.summary}</p>
              {workstream === "TESTING" && failingMandatory.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-500 space-y-2">
                  <p className="font-semibold">Mandatory test cases have not passed:</p>
                  <ul className="list-disc pl-5">
                    {failingMandatory.map((t) => (
                      <li key={t.id}>{t.title} — {t.result.toLowerCase().replace("_", " ")}</li>
                    ))}
                  </ul>
                  {lead ? (
                    <input className={inputCls} placeholder="Exception reason (needed to approve anyway)" value={exception} maxLength={500} onChange={(e) => setException(e.target.value)} />
                  ) : (
                    <p>Request changes, or ask a lead to record an exception.</p>
                  )}
                </div>
              )}
              <div>
                <label className={labelCls}>Comment (required when requesting changes)</label>
                <textarea className={`${inputCls} min-h-[70px]`} value={reviewComment} maxLength={2000} onChange={(e) => setReviewComment(e.target.value)} />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className={btnDanger}
                  disabled={busy || reviewComment.trim().length < 3}
                  onClick={() => run(() => requestChanges({ submissionId: currentSub.id, comment: reviewComment }), "Changes requested").then((r) => r && setReviewComment(""))}
                >
                  <MessageSquareWarning size={14} /> Request changes
                </button>
                <button
                  className={btnPrimary}
                  disabled={busy || !gate.ok}
                  title={!gate.ok ? gate.error : undefined}
                  onClick={() =>
                    run(() => approveSubmission({ submissionId: currentSub.id, comment: reviewComment || null, exceptionReason: exception || null }), "Approved").then((r) => {
                      if (r) {
                        setReviewComment("");
                        setException("");
                      }
                    })
                  }
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Owner status actions */}
        {canEdit && (
          <Section title="Progress">
            <div className="flex flex-wrap items-center gap-2">
              {status === "NOT_STARTED" && (
                <button className={btnPrimary} disabled={busy || dirty} onClick={() => changeStatus("IN_PROGRESS")}>
                  <Play size={14} /> Start work
                </button>
              )}
              {status === "CHANGES_REQUESTED" && (
                <button className={btnPrimary} disabled={busy || dirty} onClick={() => changeStatus("IN_PROGRESS")}>
                  <Play size={14} /> Resume work
                </button>
              )}
              {status === "BLOCKED" && (
                <button className={btnPrimary} disabled={busy || dirty} onClick={() => changeStatus("IN_PROGRESS")}>
                  <Play size={14} /> Unblock
                </button>
              )}
              {status === "IN_PROGRESS" && !blocking && (
                <button className={btnGhost} disabled={busy || dirty} onClick={() => setBlocking(true)}>
                  <Ban size={14} /> Mark blocked
                </button>
              )}
              {dirty && <span className="text-[11.5px] text-amber-500">Save your changes before changing status.</span>}
            </div>
            {blocking && (
              <div className="flex flex-wrap gap-2">
                <input className={`${inputCls} flex-1 min-w-[200px]`} autoFocus placeholder="What is blocking you?" value={blockReason} maxLength={500} onChange={(e) => setBlockReason(e.target.value)} />
                <button className={btnDanger} disabled={busy || blockReason.trim().length < 3} onClick={() => changeStatus("BLOCKED", blockReason).then((r) => { if (r) { setBlocking(false); setBlockReason(""); } })}>
                  Block
                </button>
                <button className={btnGhost} onClick={() => setBlocking(false)}>Cancel</button>
              </div>
            )}
          </Section>
        )}

        {/* Details */}
        <Section
          title="Details"
          right={
            canEdit && dirty ? (
              <button className={btnPrimary} disabled={busy} onClick={save}>
                <Save size={14} /> Save changes
              </button>
            ) : undefined
          }
        >
          <div className="space-y-3.5">
            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} disabled={!canEdit} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Description / expected outcome</label>
              <textarea className={`${inputCls} min-h-[80px]`} disabled={!canEdit} value={form.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Acceptance criteria</label>
              <textarea className={`${inputCls} min-h-[60px]`} disabled={!canEdit} value={form.acceptanceCriteria} maxLength={3000} onChange={(e) => set("acceptanceCriteria", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Due date</label>
                <input type="date" className={inputCls} disabled={!canEdit} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Progress notes / technical notes</label>
              <textarea className={`${inputCls} min-h-[70px]`} disabled={!canEdit} value={form.notes} maxLength={5000} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {/* Reference links */}
            <div>
              <label className={labelCls}>Reference links (Figma, PR, docs…)</label>
              <div className="space-y-2">
                {form.links.length === 0 && !canEdit && <p className="text-[12px] text-muted-foreground">None</p>}
                {form.links.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                    <input className={inputCls} disabled={!canEdit} placeholder="Label" value={l.label} maxLength={80} onChange={(e) => set("links", form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    {canEdit ? (
                      <input className={`${inputCls} ${l.url && !isSafeHttpUrl(l.url) ? "!border-red-500" : ""}`} placeholder="https://…" value={l.url} onChange={(e) => set("links", form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    ) : (
                      <SafeLink href={l.url} className="text-primary hover:underline truncate text-[13px]">{l.url}</SafeLink>
                    )}
                    {canEdit && <button className={btnGhost} onClick={() => set("links", form.links.filter((_, j) => j !== i))} aria-label="Remove link"><Trash2 size={13} /></button>}
                  </div>
                ))}
                {canEdit && <button className="text-[12px] text-primary font-semibold inline-flex items-center gap-1" onClick={() => set("links", [...form.links, { label: "", url: "" }])}><Plus size={12} /> Add link</button>}
              </div>
            </div>
          </div>
        </Section>

        {/* Evidence */}
        {workstream !== "TESTING" || form.evidence.length > 0 || canEdit ? (
          <Section title="Evidence">
            <p className="text-[12px] text-muted-foreground">
              {REQUIRED_EVIDENCE[workstream].length > 0
                ? `Required to submit: at least one ${REQUIRED_EVIDENCE[workstream].map((t) => EVIDENCE_LABEL[t].toLowerCase()).join(" / ")} link.`
                : "Test results are the main proof; add recordings or reports if useful."}
            </p>
            <div className="space-y-2">
              {form.evidence.length === 0 && !canEdit && <p className="text-[12px] text-muted-foreground">No evidence attached.</p>}
              {form.evidence.map((e, i) => (
                <div key={i} className="grid grid-cols-[130px_1fr_auto] gap-2 items-center">
                  {canEdit ? (
                    <select className={inputCls} value={e.type} onChange={(ev) => set("evidence", form.evidence.map((x, j) => (j === i ? { ...x, type: ev.target.value as EvidenceType } : x)))}>
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t}>{EVIDENCE_LABEL[t]}</option>
                      ))}
                    </select>
                  ) : (
                    <Pill color="#5B5FEF">{EVIDENCE_LABEL[e.type]}</Pill>
                  )}
                  {canEdit ? (
                    <input className={`${inputCls} ${e.url && !isSafeHttpUrl(e.url) ? "!border-red-500" : ""}`} placeholder="https://…" value={e.url} onChange={(ev) => set("evidence", form.evidence.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))} />
                  ) : (
                    <SafeLink href={e.url} className="text-primary hover:underline truncate text-[13px]">{e.label || e.url}</SafeLink>
                  )}
                  {canEdit && <button className={btnGhost} onClick={() => set("evidence", form.evidence.filter((_, j) => j !== i))} aria-label="Remove evidence"><Trash2 size={13} /></button>}
                </div>
              ))}
              {canEdit && (
                <button className="text-[12px] text-primary font-semibold inline-flex items-center gap-1" onClick={() => set("evidence", [...form.evidence, { type: REQUIRED_EVIDENCE[workstream][0] ?? "OTHER", url: "" }])}>
                  <Plus size={12} /> Add evidence link
                </button>
              )}
            </div>
          </Section>
        ) : null}

        {/* Test cases */}
        {workstream === "TESTING" && (
          <Section title="Test cases">
            <TestCasesPanel
              workItemId={item.id}
              pageId={item.page.id}
              cases={item.testCases}
              canEdit={canEdit}
              canRecord={canEdit && status === "IN_PROGRESS"}
              isTester={isOwner}
              openBugCaseIds={openBugCaseIds}
              devItems={devItems}
              members={members}
              onChanged={reload}
            />
            {canEdit && status !== "IN_PROGRESS" && item.testCases.length > 0 && (
              <p className="text-[11.5px] text-muted-foreground">Start the work (In Progress) to record results.</p>
            )}
          </Section>
        )}

        {/* Submit */}
        {submitAllowed && (
          <Section title={status === "CHANGES_REQUESTED" ? "Submit" : item.requiresReview ? "Submit for review" : "Complete"}>
            <div className="rounded-xl border border-surface-border bg-surface-base p-4 space-y-3">
              {item.submissions.length > 0 && (
                <p className="text-[12px] text-muted-foreground">This will create <b>submission #{item.submissions.length + 1}</b>; earlier submissions stay in the history.</p>
              )}
              <div>
                <label className={labelCls}>Summary of what you completed</label>
                <textarea className={`${inputCls} min-h-[70px]`} value={summary} maxLength={3000} onChange={(e) => setSummary(e.target.value)} />
              </div>
              {(problems.length > 0 || dirty) && (
                <ul className="text-[12px] text-amber-600 dark:text-amber-400 list-disc pl-5 space-y-0.5">
                  {dirty && <li>Save your changes first — submissions use the saved evidence.</li>}
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {submitErrors.length > 0 && (
                <ul className="text-[12px] text-red-500 list-disc pl-5 space-y-0.5">
                  {submitErrors.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {!item.reviewer && item.requiresReview && <p className="text-[12px] text-red-500">No reviewer is assigned — ask a lead to set one.</p>}
              <div className="flex justify-end">
                <button className={btnPrimary} disabled={busy || dirty || summary.trim().length < 3} onClick={submit}>
                  <Send size={14} /> {item.requiresReview ? "Submit for review" : "Submit & complete"}
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Submissions & reviews */}
        {item.submissions.length > 0 && (
          <Section title={`Submissions & reviews (${item.submissions.length})`}>
            <div className="space-y-3">
              {item.submissions.map((s) => {
                const ev = asArray<EvidenceEntry>(s.evidence);
                const tr = (Array.isArray(s.testResults) ? s.testResults : []) as unknown as TestCaseLike[];
                const current = s.id === item.currentSubmissionId;
                return (
                  <div key={s.id} className={`rounded-xl border p-4 space-y-2.5 ${current ? "border-primary/40 bg-primary/[0.03]" : "border-surface-border bg-surface-base"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground">
                        Submission #{s.submissionNumber} {current && <span className="text-[10px] text-primary font-semibold ml-1">CURRENT</span>}
                      </p>
                      <Pill color={s.status === "APPROVED" ? "#1EAE7C" : s.status === "CHANGES_REQUESTED" ? "#F59E0B" : "#A855F7"}>
                        {s.status === "APPROVED" ? "Approved" : s.status === "CHANGES_REQUESTED" ? "Changes requested" : "Awaiting review"}
                      </Pill>
                    </div>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      <UserDot user={s.submittedBy} size={16} /> {s.submittedBy.displayName} · {fmtDateTime(s.submittedAt)}
                    </p>
                    <p className="text-[12.5px] whitespace-pre-wrap text-foreground/90">{s.summary}</p>
                    {ev.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ev.map((e, i) => (
                          <SafeLink key={i} href={e.url} className="text-[12px] text-primary hover:underline">
                            {EVIDENCE_LABEL[e.type]} ↗
                          </SafeLink>
                        ))}
                      </div>
                    )}
                    {tr.length > 0 && (
                      <p className="text-[12px] text-muted-foreground">
                        Tests: {tr.filter((t) => t.result === "PASS").length} pass · {tr.filter((t) => t.result === "FAIL").length} fail · {tr.filter((t) => t.result === "BLOCKED").length} blocked · {tr.filter((t) => t.result === "NOT_RUN").length} not run
                      </p>
                    )}
                    {s.review && (
                      <div className="rounded-lg bg-surface-elevated border border-surface-border p-3 text-[12.5px]">
                        <p className="flex items-center gap-1.5 font-semibold text-foreground">
                          <UserDot user={s.review.reviewer} size={16} />
                          {s.review.reviewer.displayName}{" "}
                          {s.review.decision === "APPROVED" ? "approved" : "requested changes"}
                          <span className="font-normal text-muted-foreground text-[11px]">· {fmtDateTime(s.review.reviewedAt)}</span>
                        </p>
                        {s.review.comment && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.review.comment}</p>}
                        {s.review.exceptionReason && (
                          <p className="mt-1 text-amber-600 dark:text-amber-400"><b>Test exception:</b> {s.review.exceptionReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Bugs */}
        {allBugs.length > 0 && (
          <Section title={`Linked bugs (${allBugs.length})`}>
            <div className="space-y-3">
              {allBugs.map((b) => (
                <BugCard
                  key={b.id}
                  bug={{ ...(b as unknown as BugRow), testWorkItem: { id: item.id, title: item.title, assigneeId: item.assigneeId } }}
                  viewer={viewer}
                  members={members}
                  devItems={devItems}
                  onChanged={reload}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Lead controls */}
        {lead && (
          <Section title="Ownership & planning (lead)">
            <LeadControls item={item} members={members} onChanged={reload} />
          </Section>
        )}
        {viewer.role === "ADMIN" && !isOwner && (
          <AdminOverride item={item} viewer={viewer} onChanged={reload} />
        )}

        {/* Comments */}
        <Section title={`Comments (${item.comments.length})`}>
          <div className="space-y-3">
            {item.comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <UserDot user={c.author} size={26} />
                <div className="min-w-0 flex-1 rounded-xl bg-surface-base border border-surface-border px-3 py-2">
                  <p className="text-[11.5px] text-muted-foreground">
                    <b className="text-foreground">{c.author.displayName}</b> · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </p>
                  <p className="text-[12.5px] whitespace-pre-wrap text-foreground/90 mt-0.5">{c.body}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <textarea className={`${inputCls} min-h-[44px] flex-1`} placeholder="Add a comment… use @username to mention" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
              <button
                className={btnPrimary + " self-end"}
                disabled={busy || !comment.trim()}
                onClick={() => run(() => addWorkItemComment({ workItemId: item.id, body: comment })).then((r) => r && setComment(""))}
              >
                Post
              </button>
            </div>
          </div>
        </Section>

        {/* Activity */}
        <Section title="Activity">
          {audits.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {audits.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-[12px]">
                  <UserDot user={a.actor} size={20} />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground">
                      <b className="text-foreground">{a.actor.displayName}</b> {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                      {a.summary && a.action !== "COMMENTED" ? <span className="text-foreground/80"> — {a.summary}</span> : null}
                      {a.isOverride && <span className="ml-2"><Pill color="#D1495B">admin override</Pill></span>}
                    </p>
                    {a.action === "COMMENTED" && a.summary && <p className="text-muted-foreground/80">“{a.summary}”</p>}
                    {a.reason && <p className="text-muted-foreground/90">Reason: {a.reason}</p>}
                    <ChangeDiff before={a.before} after={a.after} />
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

/** Compact, human-readable before → after for audit rows (status / owner / reviewer ids are resolved by name where possible). */
function ChangeDiff({ before, after }: { before: unknown; after: unknown }) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = Object.keys(a).filter((k) => k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !k.endsWith("Id"));
  if (keys.length === 0) return null;
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v).replace(/_/g, " ").toLowerCase());
  return (
    <p className="text-[11.5px] text-muted-foreground/80">
      {keys.map((k) => `${k}: ${show(b[k])} → ${show(a[k])}`).join(" · ")}
    </p>
  );
}
