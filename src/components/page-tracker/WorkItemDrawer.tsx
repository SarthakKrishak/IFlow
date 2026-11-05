"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Kanban,
  Loader2,
  Lock,
  MessageSquareWarning,
  Pencil,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  ACTION_LABEL,
  EVIDENCE_LABEL,
  EVIDENCE_TYPES,
  REQUIRED_EVIDENCE,
  STATUS_LABEL,
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
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  PriorityBadge,
  SafeLink,
  StatusBadge,
  UserChip,
  UserDot,
  WorkItemStatusIcon,
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
type Tab = "overview" | "evidence" | "submissions" | "bugs" | "discussion" | "activity";

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const OPEN_BUG = (s: string) => !["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"].includes(s);

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

// ── Loader: fetches the item, then renders the view ──────────────────────────

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

  const load = useCallback(async () => {
    const r = await getWorkItemDetail({ workItemId: itemId });
    if (!r.success) return setError(r.error);
    setError(null);
    setData(r.data);
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the sheet and the page behind it together.
  const reload = useCallback(async () => {
    onChanged();
    await load();
  }, [load, onChanged]);

  return (
    <Sheet onClose={onClose}>
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <WorkItemView data={data} viewer={viewer} members={members} devItems={devItems} onClose={onClose} reload={reload} refetch={load} />
      )}
    </Sheet>
  );
}

/** Right-hand sheet; full screen on phones. Locks page scroll, closes on Esc / backdrop. */
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 animate-in fade-in duration-150" onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Work item"
        className="w-full sm:w-[min(1040px,100vw)] h-[100dvh] bg-background sm:border-l border-surface-border shadow-2xl flex flex-col animate-in slide-in-from-right-4 duration-200"
      >
        {children}
      </aside>
    </div>
  );
}

// ── View ─────────────────────────────────────────────────────────────────────

export function WorkItemView({
  data,
  viewer,
  members,
  devItems,
  onClose,
  reload,
  refetch,
}: {
  data: WorkItemDetail;
  viewer: Viewer;
  members: Member[];
  devItems: { id: string; title: string }[];
  onClose: () => void;
  /** Refresh this item and the page behind it. */
  reload: () => Promise<void>;
  /** Refresh only this item (e.g. after a stale-write rejection). */
  refetch: () => Promise<void>;
}) {
  const { item, audits } = data;
  const status = item.status as WorkItemStatus;
  const workstream = item.workstream as Workstream;
  const lead = isLeadRole(viewer);
  const isOwner = item.assigneeId === viewer.id;
  const edit = canEditWorkItem(viewer, item);
  const canEdit = edit.ok;

  // Form state, re-synced from the server unless the user has unsaved edits.
  const baseline = useRef(JSON.stringify(formFromItem(item)));
  const [form, setForm] = useState<FormState>(() => formFromItem(item));
  const formRef = useRef(form);
  formRef.current = form;
  useEffect(() => {
    const next = formFromItem(item);
    const wasDirty = JSON.stringify(formRef.current) !== baseline.current;
    baseline.current = JSON.stringify(next);
    if (!wasDirty) setForm(next);
  }, [item]);

  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [comment, setComment] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [exception, setException] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  const dirty = JSON.stringify(form) !== baseline.current;
  const showForm = canEdit && (editing || dirty);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const currentSub = item.submissions.find((s) => s.id === item.currentSubmissionId) ?? null;
  const reviewDecision = currentSub
    ? canReview(viewer, item, { id: currentSub.id, submittedById: currentSub.submittedById, status: currentSub.status })
    : null;
  const amReviewer = status === "READY_FOR_REVIEW" && !!currentSub && !!reviewDecision?.ok;
  const lastChangeRequest = item.submissions.find((s) => s.review?.decision === "CHANGES_REQUESTED")?.review ?? null;
  const overdue = isOverdue(item.dueDate, status);

  const allBugs = [...item.testBugs, ...item.devBugs.filter((b) => !item.testBugs.some((t) => t.id === b.id))];
  const openBugs = allBugs.filter((b) => OPEN_BUG(b.status));
  const openBugCaseIds = new Set(item.testBugs.filter((b) => b.testCaseId && OPEN_BUG(b.status)).map((b) => b.testCaseId!));

  const run = async <T,>(fn: () => Promise<{ success: boolean; error?: string; data?: T }>, ok?: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Something went wrong");
      await refetch(); // stale? show the newest version
      return null;
    }
    if (ok) toast.success(ok);
    await reload();
    return r;
  };

  const save = async () => {
    const base = JSON.parse(baseline.current) as FormState;
    const changes: Record<string, unknown> = {};
    if (form.title !== base.title) changes.title = form.title;
    if (form.description !== base.description) changes.description = form.description;
    if (form.acceptanceCriteria !== base.acceptanceCriteria) changes.acceptanceCriteria = form.acceptanceCriteria;
    if (form.notes !== base.notes) changes.notes = form.notes;
    if (form.dueDate !== base.dueDate) changes.dueDate = isoFromDateInput(form.dueDate);
    if (JSON.stringify(form.links) !== JSON.stringify(base.links))
      changes.links = form.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() }));
    if (JSON.stringify(form.evidence) !== JSON.stringify(base.evidence))
      changes.evidence = form.evidence.filter((e) => e.url.trim()).map((e) => ({ type: e.type, url: e.url.trim(), ...(e.label ? { label: e.label } : {}) }));
    if (Object.keys(changes).length === 0) return setEditing(false);
    setBusy(true);
    const r = await updateWorkItem({ workItemId: item.id, expectedVersion: item.version, changes });
    setBusy(false);
    if (!r.success) return toast.error(r.error); // edits are kept on failure
    toast.success("Saved");
    baseline.current = JSON.stringify(form);
    setEditing(false);
    await reload();
  };
  const discard = () => {
    setForm(JSON.parse(baseline.current) as FormState);
    setEditing(false);
  };

  const changeStatus = (to: WorkItemStatus, reason?: string) =>
    run(() => changeWorkItemStatus({ workItemId: item.id, expectedVersion: item.version, to, reason: reason ?? null }));

  // Live submission checklist (the server re-validates everything).
  const savedEvidence = asArray<EvidenceEntry>(item.evidence);
  const problems = validateSubmission({ workstream, summary: summary || "ok", evidence: savedEvidence, testCases: item.testCases }).filter(
    (p) => !(summary === "" && p.startsWith("Add a short summary"))
  );
  const submitAllowed = canEdit && canSubmit(item).ok;

  const submit = async () => {
    setSubmitErrors([]);
    setBusy(true);
    const r = await submitWorkItem({ workItemId: item.id, expectedVersion: item.version, summary });
    setBusy(false);
    if (!r.success) {
      setSubmitErrors(r.error.split("\n"));
      await refetch();
      return;
    }
    toast.success(r.data.status === "DONE" ? "Submitted and completed" : "Submitted for review");
    setSummary("");
    setSubmitOpen(false);
    await reload();
  };

  // Testing approval gate preview.
  const snapshot = (Array.isArray(currentSub?.testResults) ? currentSub!.testResults : []) as unknown as TestCaseLike[];
  const gate = workstream === "TESTING" && currentSub ? validateTestingApproval(viewer, snapshot, exception || null) : { ok: true as const };
  const failingMandatory = snapshot.filter((t) => t.isMandatory && t.result !== "PASS");

  const tabs: { id: Tab; label: string; count?: number; hidden?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "evidence", label: workstream === "TESTING" ? "Tests & evidence" : "Evidence", count: workstream === "TESTING" ? item.testCases.length : savedEvidence.length },
    { id: "submissions", label: "Submissions", count: item.submissions.length },
    { id: "bugs", label: "Bugs", count: openBugs.length, hidden: allBugs.length === 0 },
    { id: "discussion", label: "Discussion", count: item.comments.length },
    { id: "activity", label: "Activity" },
  ];

  return (
    <>
      {/* Top bar */}
      <div className="h-12 shrink-0 px-4 sm:px-5 flex items-center justify-between gap-3 border-b border-surface-border pt-[env(safe-area-inset-top)] box-content">
        <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground min-w-0" aria-label="Breadcrumb">
          <Link href={`/page-tracker/${item.page.id}`} className="truncate hover:text-foreground transition-colors">
            {item.page.name}
          </Link>
          <ChevronRight size={13} className="opacity-60 shrink-0" />
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-sm" style={{ background: WORKSTREAM_COLOR[workstream] }} />
            {WORKSTREAM_LABEL[workstream]}
          </span>
          {busy && <Loader2 size={12} className="animate-spin ml-1.5" />}
        </nav>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors" aria-label="Close" title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_288px]">
        {/* ── Main column ── */}
        <div className="lg:overflow-y-auto custom-scrollbar">
          <div className="px-5 sm:px-8 pt-6 pb-10 max-w-[720px]">
            {/* Title + stepper */}
            <h1
              className={cn(
                "text-[22px] font-semibold tracking-[-0.02em] leading-snug text-foreground",
                (status === "DONE" || status === "CANCELLED") && "text-muted-foreground"
              )}
            >
              {item.title}
            </h1>
            <Stepper status={status} requiresReview={item.requiresReview} />

            {/* Next step: the one thing that matters for this viewer */}
            <div className="mt-5">
              <NextStep>
                {isOwner && !item.ownerAcknowledged && !item.archivedAt && status !== "DONE" && status !== "CANCELLED" ? (
                  <Banner
                    tone="warning"
                    title="This item was reassigned to you"
                    body="Look over the history and current state, then acknowledge ownership to start editing."
                    action={
                      <Button variant="primary" loading={busy} onClick={() => run(() => acknowledgeOwnership({ workItemId: item.id }), "You now own this item")}>
                        <ShieldCheck size={14} /> Acknowledge
                      </Button>
                    }
                  />
                ) : amReviewer && currentSub ? (
                  <ReviewBox
                    submission={currentSub}
                    workstream={workstream}
                    failingMandatory={failingMandatory}
                    lead={lead}
                    exception={exception}
                    setException={setException}
                    comment={reviewComment}
                    setComment={setReviewComment}
                    busy={busy}
                    gate={gate}
                    onApprove={() =>
                      run(() => approveSubmission({ submissionId: currentSub.id, comment: reviewComment || null, exceptionReason: exception || null }), "Approved").then((r) => {
                        if (r) {
                          setReviewComment("");
                          setException("");
                        }
                      })
                    }
                    onRequestChanges={() =>
                      run(() => requestChanges({ submissionId: currentSub.id, comment: reviewComment }), "Changes requested").then((r) => r && setReviewComment(""))
                    }
                  />
                ) : canEdit ? (
                  <OwnerStep
                    status={status}
                    busy={busy}
                    dirty={dirty}
                    requiresReview={item.requiresReview}
                    hasReviewer={!!item.reviewer}
                    blockedReason={item.blockedReason}
                    lastChangeRequest={lastChangeRequest}
                    blocking={blocking}
                    setBlocking={setBlocking}
                    blockReason={blockReason}
                    setBlockReason={setBlockReason}
                    onStatus={changeStatus}
                    submitAllowed={submitAllowed}
                    submitOpen={submitOpen}
                    setSubmitOpen={setSubmitOpen}
                    summary={summary}
                    setSummary={setSummary}
                    problems={problems}
                    submitErrors={submitErrors}
                    nextNumber={item.submissions.length + 1}
                    onSubmit={submit}
                  />
                ) : (
                  <ObserverStep
                    status={status}
                    item={item}
                    isOwner={isOwner}
                    editError={edit.ok === false ? edit.error : null}
                    currentSubNumber={currentSub?.submissionNumber ?? null}
                  />
                )}
              </NextStep>
            </div>

            {/* Tabs */}
            <div className="mt-8 flex items-center gap-5 border-b border-surface-border overflow-x-auto no-scrollbar" role="tablist">
              {tabs
                .filter((t) => !t.hidden)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "h-10 -mb-px flex items-center gap-1.5 border-b-[1.5px] text-[13px] whitespace-nowrap transition-colors",
                      tab === t.id ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                    {!!t.count && <span className="text-[11.5px] text-muted-foreground tabular-nums">{t.count}</span>}
                  </button>
                ))}
            </div>

            <div className="pt-6">
              {tab === "overview" &&
                (showForm ? (
                  <DetailsForm form={form} set={set} />
                ) : (
                  <DetailsRead item={item} canEdit={canEdit} onEdit={() => setEditing(true)} />
                ))}

              {tab === "evidence" && (
                <div className="space-y-8">
                  <EvidenceSection form={form} set={set} saved={savedEvidence} canEdit={canEdit} workstream={workstream} />
                  {workstream === "TESTING" && (
                    <section>
                      <h3 className="text-[13px] font-semibold text-foreground mb-3">Test cases</h3>
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
                        <p className="text-[12px] text-muted-foreground mt-3">Start the work to record results.</p>
                      )}
                    </section>
                  )}
                </div>
              )}

              {tab === "submissions" && <Submissions item={item} />}

              {tab === "bugs" && (
                <div className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
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
              )}

              {tab === "discussion" && (
                <Discussion
                  comments={item.comments}
                  value={comment}
                  setValue={setComment}
                  busy={busy}
                  onPost={() => run(() => addWorkItemComment({ workItemId: item.id, body: comment })).then((r) => r && setComment(""))}
                />
              )}

              {tab === "activity" && <Activity audits={audits} />}
            </div>
          </div>

          {/* Unsaved-changes bar */}
          {canEdit && dirty && (
            <div className="sticky bottom-0 border-t border-surface-border bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur px-5 sm:px-8 py-3 flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <span className="text-[12.5px] text-muted-foreground">You have unsaved changes</span>
              <div className="flex gap-2">
                <Button onClick={discard} disabled={busy}>
                  Discard
                </Button>
                <Button variant="primary" onClick={save} loading={busy}>
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Properties sidebar ── */}
        <aside className="border-t lg:border-t-0 lg:border-l border-surface-border bg-surface-base/60 lg:overflow-y-auto custom-scrollbar">
          <div className="px-5 py-6 space-y-5">
            <Prop label="Status">
              <StatusBadge status={status} />
            </Prop>
            <Prop label="Owner">
              <UserChip user={item.assignee} />
            </Prop>
            <Prop label="Reviewer">
              <UserChip user={item.reviewer} empty={item.requiresReview ? "Not set" : "Not required"} />
            </Prop>
            <Prop label="Priority">
              <PriorityBadge priority={item.priority as never} />
            </Prop>
            <Prop label="Due">
              <span className={cn("text-[12.5px] tabular-nums", overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground/85")}>
                {item.dueDate ? fmtDate(item.dueDate) : "—"}
                {overdue && " · overdue"}
              </span>
            </Prop>
            <Prop label="Completion">
              <span className="text-[12.5px] text-foreground/85" title={item.exclusionReason ?? undefined}>
                {item.isRequired ? "Required" : "Optional"}
                {item.archivedAt && " · archived"}
              </span>
            </Prop>
            {item.ticket && (
              <Prop label="Board">
                <Link href={`/board/${item.ticket.boardId}?ticket=${item.ticket.id}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/85 hover:underline underline-offset-2 min-w-0">
                  <Kanban size={13} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {item.ticket.board.name} · {item.ticket.column.name}
                  </span>
                </Link>
              </Prop>
            )}
            {openBugs.length > 0 && (
              <Prop label="Bugs">
                <button type="button" onClick={() => setTab("bugs")} className="text-[12.5px] text-orange-600 dark:text-orange-400 hover:underline underline-offset-2">
                  {openBugs.length} open
                </button>
              </Prop>
            )}

            {(lead || (viewer.role === "ADMIN" && !isOwner)) && (
              <div className="pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setManageOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground"
                  aria-expanded={manageOpen}
                >
                  Manage
                  <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", manageOpen && "rotate-180")} />
                </button>
                <p className="text-[11.5px] text-muted-foreground mt-1">Reassign, change reviewer, required/optional, cancel.</p>
                {manageOpen && (
                  <div className="mt-4 space-y-5">
                    {lead && <LeadControls item={item} members={members} onChanged={reload} />}
                    {viewer.role === "ADMIN" && !isOwner && <AdminOverride item={item} viewer={viewer} onChanged={reload} />}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2 min-h-6">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Not started → In progress → (In review) → Done, with the current step and its state highlighted. */
function Stepper({ status, requiresReview }: { status: WorkItemStatus; requiresReview: boolean }) {
  if (status === "CANCELLED") {
    return <p className="mt-3 text-[12.5px] text-muted-foreground">This item was cancelled.</p>;
  }
  const steps = requiresReview ? ["Not started", "In progress", "In review", "Done"] : ["Not started", "In progress", "Done"];
  const at =
    status === "NOT_STARTED" ? 0 : status === "READY_FOR_REVIEW" ? 2 : status === "DONE" ? steps.length - 1 : 1; // in progress / blocked / changes
  const note = status === "BLOCKED" ? "Blocked" : status === "CHANGES_REQUESTED" ? "Changes requested" : null;
  return (
    <ol className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {steps.map((s, i) => {
        const done = i < at || status === "DONE";
        const current = i === at && status !== "DONE";
        return (
          <li key={s} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <span className={cn("w-6 h-px", done || current ? "bg-foreground/40" : "bg-surface-border")} />}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[12px] border",
                current
                  ? note === "Blocked"
                    ? "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/[0.06]"
                    : note
                      ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/[0.06]"
                      : "border-foreground/25 text-foreground bg-surface-hover font-medium"
                  : done
                    ? "border-transparent text-foreground/70"
                    : "border-transparent text-muted-foreground/70"
              )}
            >
              {done && <CheckCircle2 size={12} className="text-emerald-500" />}
              {current && note ? note : s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NextStep({ children }: { children: React.ReactNode }) {
  return <section aria-label="Next step">{children}</section>;
}

function Banner({
  tone = "neutral",
  title,
  body,
  action,
  children,
}: {
  tone?: "neutral" | "warning" | "danger" | "success" | "review";
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const toneCls = {
    neutral: "border-surface-border bg-surface-elevated",
    warning: "border-amber-500/30 bg-amber-500/[0.05]",
    danger: "border-red-500/30 bg-red-500/[0.04]",
    success: "border-emerald-500/30 bg-emerald-500/[0.05]",
    review: "border-primary/30 bg-primary/[0.04]",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-4", toneCls)}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
          {body && <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{body}</div>}
        </div>
        {action && <div className="flex flex-wrap gap-2 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">{action}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function OwnerStep(p: {
  status: WorkItemStatus;
  busy: boolean;
  dirty: boolean;
  requiresReview: boolean;
  hasReviewer: boolean;
  blockedReason: string | null;
  lastChangeRequest: { comment: string | null; reviewer: { displayName: string } } | null;
  blocking: boolean;
  setBlocking: (v: boolean) => void;
  blockReason: string;
  setBlockReason: (v: string) => void;
  onStatus: (to: WorkItemStatus, reason?: string) => Promise<unknown>;
  submitAllowed: boolean;
  submitOpen: boolean;
  setSubmitOpen: (v: boolean) => void;
  summary: string;
  setSummary: (v: string) => void;
  problems: string[];
  submitErrors: string[];
  nextNumber: number;
  onSubmit: () => void;
}) {
  const saveFirst = p.dirty ? <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-2">Save your changes first.</p> : null;

  if (p.status === "NOT_STARTED")
    return (
      <Banner
        title="Ready when you are"
        body="Start the work to move it to In progress — teammates will see it's underway."
        action={
          <Button variant="primary" disabled={p.dirty} loading={p.busy} onClick={() => p.onStatus("IN_PROGRESS")}>
            <Play size={14} /> Start work
          </Button>
        }
      >
        {saveFirst}
      </Banner>
    );

  if (p.status === "BLOCKED")
    return (
      <Banner
        tone="danger"
        title="Blocked"
        body={p.blockedReason ? `“${p.blockedReason}”` : undefined}
        action={
          <Button variant="primary" disabled={p.dirty} loading={p.busy} onClick={() => p.onStatus("IN_PROGRESS")}>
            <Play size={14} /> Unblock
          </Button>
        }
      />
    );

  if (p.status === "CHANGES_REQUESTED")
    return (
      <Banner
        tone="warning"
        title={`${p.lastChangeRequest?.reviewer.displayName ?? "The reviewer"} requested changes`}
        body={p.lastChangeRequest?.comment ? <span className="whitespace-pre-wrap">“{p.lastChangeRequest.comment}”</span> : undefined}
        action={
          <Button variant="primary" disabled={p.dirty} loading={p.busy} onClick={() => p.onStatus("IN_PROGRESS")}>
            <Play size={14} /> Resume work
          </Button>
        }
      />
    );

  if (p.status === "IN_PROGRESS") {
    const label = p.requiresReview ? "Submit for review" : "Submit & complete";
    return (
      <Banner
        tone="review"
        title="In progress"
        body={
          p.requiresReview
            ? "When it's done, attach your evidence and submit it — your reviewer approves or sends it back."
            : "When it's done, attach your evidence and submit it to complete the item."
        }
        action={
          !p.submitOpen && (
            <>
              {!p.blocking && (
                <Button disabled={p.dirty || p.busy} onClick={() => p.setBlocking(true)}>
                  <Ban size={14} /> Blocked
                </Button>
              )}
              <Button variant="primary" disabled={!p.submitAllowed} onClick={() => p.setSubmitOpen(true)}>
                <Send size={14} /> {label}
              </Button>
            </>
          )
        }
      >
        {p.blocking && (
          <div className="flex flex-wrap gap-2">
            <input
              className={cn(inputCls, "flex-1 min-w-[200px]")}
              autoFocus
              placeholder="What is blocking you?"
              value={p.blockReason}
              maxLength={500}
              onChange={(e) => p.setBlockReason(e.target.value)}
            />
            <Button variant="danger" disabled={p.busy || p.blockReason.trim().length < 3} onClick={() => p.onStatus("BLOCKED", p.blockReason).then((r) => r && (p.setBlocking(false), p.setBlockReason("")))}>
              Mark blocked
            </Button>
            <Button variant="ghost" onClick={() => p.setBlocking(false)}>
              Cancel
            </Button>
          </div>
        )}
        {p.submitOpen && (
          <div className="space-y-3">
            {p.nextNumber > 1 && <p className="text-[12.5px] text-muted-foreground">This becomes submission #{p.nextNumber}. Earlier submissions stay in the history.</p>}
            <div>
              <label className={labelCls}>What did you complete?</label>
              <Textarea autoFocus value={p.summary} maxLength={3000} onChange={(e) => p.setSummary(e.target.value)} placeholder="A short summary for your reviewer" />
            </div>
            {(p.problems.length > 0 || p.dirty) && (
              <ul className="text-[12.5px] text-amber-700 dark:text-amber-400 space-y-1">
                {p.dirty && <li>• Save your changes first — the submission uses saved evidence.</li>}
                {p.problems.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            )}
            {p.submitErrors.length > 0 && (
              <ul className="text-[12.5px] text-red-600 dark:text-red-400 space-y-1">
                {p.submitErrors.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            )}
            {!p.hasReviewer && p.requiresReview && <p className="text-[12.5px] text-red-600 dark:text-red-400">No reviewer is assigned — ask a lead to set one.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => p.setSubmitOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={p.busy} disabled={p.dirty || p.summary.trim().length < 3} onClick={p.onSubmit}>
                <Send size={14} /> {label}
              </Button>
            </div>
          </div>
        )}
      </Banner>
    );
  }

  if (p.status === "READY_FOR_REVIEW") return <Banner title="Submitted — waiting for review" body="You'll be notified when your reviewer approves it or asks for changes." />;
  if (p.status === "DONE") return <Banner tone="success" title="Done" body="This item is complete." />;
  return null;
}

function ObserverStep({
  status,
  item,
  isOwner,
  editError,
  currentSubNumber,
}: {
  status: WorkItemStatus;
  item: WorkItemDetail["item"];
  isOwner: boolean;
  editError: string | null;
  currentSubNumber: number | null;
}) {
  if (status === "DONE") return <Banner tone="success" title="Done" body={`Completed by ${item.assignee.displayName}.`} />;
  if (status === "CANCELLED") return <Banner title="Cancelled" body={item.cancelledReason ? `“${item.cancelledReason}”` : undefined} />;
  if (isOwner && editError) return <Banner title="You can't edit this right now" body={editError} />;
  const waiting =
    status === "READY_FOR_REVIEW"
      ? `Waiting for ${item.reviewer?.displayName ?? "the reviewer"} to review submission #${currentSubNumber ?? 1}.`
      : status === "BLOCKED"
        ? `Blocked${item.blockedReason ? `: “${item.blockedReason}”` : ""}.`
        : status === "CHANGES_REQUESTED"
          ? `Waiting for ${item.assignee.displayName} to address the requested changes.`
          : `${item.assignee.displayName} owns this item${status === "IN_PROGRESS" ? " and is working on it" : ""}.`;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-surface-border px-4 py-3 text-[13px] text-muted-foreground">
      <Lock size={14} className="mt-0.5 shrink-0" />
      <span>
        {waiting} Only <span className="text-foreground font-medium">{item.assignee.displayName}</span> can update it.
      </span>
    </div>
  );
}

function ReviewBox(p: {
  submission: WorkItemDetail["item"]["submissions"][number];
  workstream: Workstream;
  failingMandatory: TestCaseLike[];
  lead: boolean;
  exception: string;
  setException: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  busy: boolean;
  gate: { ok: true } | { ok: false; error: string };
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  const ev = asArray<EvidenceEntry>(p.submission.evidence);
  return (
    <Banner
      tone="review"
      title={`Your review — submission #${p.submission.submissionNumber}`}
      body={`From ${p.submission.submittedBy.displayName} · ${fmtDateTime(p.submission.submittedAt)}. You can approve or request changes; you can't edit their work.`}
    >
      <div className="space-y-4">
        <p className="text-[13.5px] whitespace-pre-wrap text-foreground/90 leading-relaxed">{p.submission.summary}</p>
        {ev.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ev.map((e, i) => (
              <SafeLink key={i} href={e.url} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-surface-border bg-surface-elevated text-[12.5px] text-foreground hover:border-foreground/20">
                <ExternalLink size={12} /> {e.label || EVIDENCE_LABEL[e.type]}
              </SafeLink>
            ))}
          </div>
        )}
        {p.workstream === "TESTING" && p.failingMandatory.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] p-3 text-[12.5px] text-red-600 dark:text-red-400 space-y-2">
            <p className="font-medium">Mandatory test cases haven't passed:</p>
            <ul className="space-y-0.5">
              {p.failingMandatory.map((t) => (
                <li key={t.id}>
                  • {t.title} — {t.result.toLowerCase().replace("_", " ")}
                </li>
              ))}
            </ul>
            {p.lead ? (
              <input className={inputCls} placeholder="Exception reason (needed to approve anyway)" value={p.exception} maxLength={500} onChange={(e) => p.setException(e.target.value)} />
            ) : (
              <p>Request changes, or ask a lead to record an exception.</p>
            )}
          </div>
        )}
        <div>
          <label className={labelCls}>Comment {""}<span className="font-normal text-muted-foreground">— required when requesting changes</span></label>
          <Textarea value={p.comment} maxLength={2000} onChange={(e) => p.setComment(e.target.value)} placeholder="What's good, or what needs to change?" />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" disabled={p.busy || p.comment.trim().length < 3} onClick={p.onRequestChanges}>
            <MessageSquareWarning size={14} /> Request changes
          </Button>
          <Button variant="primary" loading={p.busy} disabled={!p.gate.ok} title={!p.gate.ok ? p.gate.error : undefined} onClick={p.onApprove}>
            <CheckCircle2 size={14} /> Approve
          </Button>
        </div>
      </div>
    </Banner>
  );
}

function ReadBlock({ label, children, empty }: { label: string; children?: React.ReactNode; empty: string }) {
  return (
    <section>
      <h3 className="text-[12.5px] font-medium text-muted-foreground mb-2">{label}</h3>
      {children ? <div className="text-[14px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{children}</div> : <p className="text-[13px] text-muted-foreground/70">{empty}</p>}
    </section>
  );
}

function DetailsRead({ item, canEdit, onEdit }: { item: WorkItemDetail["item"]; canEdit: boolean; onEdit: () => void }) {
  const links = asArray<LinkRow>(item.links);
  return (
    <div className="space-y-7">
      {canEdit && (
        <div className="flex justify-end -mt-2 -mb-3">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil size={13} /> Edit details
          </Button>
        </div>
      )}
      <ReadBlock label="Description" empty="No description.">
        {item.description}
      </ReadBlock>
      <ReadBlock label="Acceptance criteria" empty="No acceptance criteria — the reviewer will judge against the description.">
        {item.acceptanceCriteria}
      </ReadBlock>
      {(item.notes || canEdit) && (
        <ReadBlock label="Progress notes" empty="No notes yet.">
          {item.notes}
        </ReadBlock>
      )}
      <section>
        <h3 className="text-[12.5px] font-medium text-muted-foreground mb-2">References</h3>
        {links.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/70">No links.</p>
        ) : (
          <ul className="space-y-1.5">
            {links.map((l, i) => (
              <li key={i}>
                <SafeLink href={l.url} className="inline-flex items-center gap-1.5 text-[13.5px] text-foreground hover:underline underline-offset-2 break-all">
                  <ExternalLink size={13} className="text-muted-foreground shrink-0" /> {l.label || l.url}
                </SafeLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailsForm({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Description / expected outcome</label>
        <Textarea className="min-h-[96px]" value={form.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Acceptance criteria</label>
        <Textarea value={form.acceptanceCriteria} maxLength={3000} onChange={(e) => set("acceptanceCriteria", e.target.value)} placeholder="How will the reviewer know it's done?" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Due date</label>
          <input type="date" className={inputCls} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Progress / technical notes</label>
        <Textarea value={form.notes} maxLength={5000} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>References (Figma, PR, docs…)</label>
        <div className="space-y-2">
          {form.links.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-center">
              <input className={inputCls} placeholder="Label" value={l.label} maxLength={80} onChange={(e) => set("links", form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input
                className={cn(inputCls, l.url && !isSafeHttpUrl(l.url) && "!border-red-500")}
                placeholder="https://…"
                value={l.url}
                onChange={(e) => set("links", form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <button type="button" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-surface-hover" onClick={() => set("links", form.links.filter((_, j) => j !== i))} aria-label="Remove link">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => set("links", [...form.links, { label: "", url: "" }])}>
            <Plus size={13} /> Add link
          </Button>
        </div>
      </div>
    </div>
  );
}

function EvidenceSection({
  form,
  set,
  saved,
  canEdit,
  workstream,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  saved: EvidenceEntry[];
  canEdit: boolean;
  workstream: Workstream;
}) {
  const required = REQUIRED_EVIDENCE[workstream];
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-foreground">Evidence</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1 mb-4">
        {required.length > 0
          ? `Needed to submit: at least one ${required.map((t) => EVIDENCE_LABEL[t].toLowerCase()).join(" or ")} link.`
          : "Test results are the main proof here; add recordings or reports if they help."}
      </p>
      {canEdit ? (
        <div className="space-y-2">
          {form.evidence.map((e, i) => (
            <div key={i} className="grid grid-cols-[132px_minmax(0,1fr)_auto] gap-2 items-center">
              <select className={inputCls} value={e.type} onChange={(ev) => set("evidence", form.evidence.map((x, j) => (j === i ? { ...x, type: ev.target.value as EvidenceType } : x)))}>
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVIDENCE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                className={cn(inputCls, e.url && !isSafeHttpUrl(e.url) && "!border-red-500")}
                placeholder="https://…"
                value={e.url}
                onChange={(ev) => set("evidence", form.evidence.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))}
              />
              <button type="button" className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-surface-hover" onClick={() => set("evidence", form.evidence.filter((_, j) => j !== i))} aria-label="Remove evidence">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => set("evidence", [...form.evidence, { type: required[0] ?? "OTHER", url: "" }])}>
            <Plus size={13} /> Add evidence link
          </Button>
        </div>
      ) : saved.length === 0 ? (
        <p className="text-[13px] text-muted-foreground/70">No evidence attached yet.</p>
      ) : (
        <ul className="rounded-xl border border-surface-border divide-y divide-surface-border">
          {saved.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-4 h-11">
              <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{EVIDENCE_LABEL[e.type]}</span>
              <SafeLink href={e.url} className="text-[13px] text-foreground hover:underline underline-offset-2 truncate">
                {e.label || e.url}
              </SafeLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Submissions({ item }: { item: WorkItemDetail["item"] }) {
  if (item.submissions.length === 0) return <p className="text-[13px] text-muted-foreground">Nothing submitted yet. Each submission is kept here as a permanent version.</p>;
  return (
    <ol className="relative space-y-5">
      {item.submissions.map((s, idx) => {
        const ev = asArray<EvidenceEntry>(s.evidence);
        const tr = (Array.isArray(s.testResults) ? s.testResults : []) as unknown as TestCaseLike[];
        const current = s.id === item.currentSubmissionId;
        const decision = s.status === "APPROVED" ? { label: "Approved", cls: "text-emerald-600 dark:text-emerald-400" } : s.status === "CHANGES_REQUESTED" ? { label: "Changes requested", cls: "text-amber-600 dark:text-amber-400" } : { label: "Awaiting review", cls: "text-primary" };
        return (
          <li key={s.id} className="relative pl-7">
            {idx < item.submissions.length - 1 && <span className="absolute left-[9px] top-6 -bottom-5 w-px bg-surface-border" aria-hidden="true" />}
            <span className={cn("absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums ring-1", current ? "bg-foreground text-background ring-foreground" : "bg-surface-elevated text-muted-foreground ring-surface-border")}>
              {s.submissionNumber}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[13.5px] font-medium text-foreground">Submission #{s.submissionNumber}</p>
              <span className={cn("text-[12.5px]", decision.cls)}>{decision.label}</span>
              <span className="text-[12px] text-muted-foreground">
                · {s.submittedBy.displayName} · {fmtDateTime(s.submittedAt)}
              </span>
            </div>
            <p className="text-[13.5px] whitespace-pre-wrap text-foreground/90 mt-2 leading-relaxed">{s.summary}</p>
            {ev.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {ev.map((e, i) => (
                  <SafeLink key={i} href={e.url} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-surface-border text-[12.5px] text-foreground hover:border-foreground/20">
                    <ExternalLink size={12} /> {e.label || EVIDENCE_LABEL[e.type]}
                  </SafeLink>
                ))}
              </div>
            )}
            {tr.length > 0 && (
              <p className="text-[12.5px] text-muted-foreground mt-2 tabular-nums">
                Tests: {tr.filter((t) => t.result === "PASS").length} pass · {tr.filter((t) => t.result === "FAIL").length} fail · {tr.filter((t) => t.result === "BLOCKED").length} blocked · {tr.filter((t) => t.result === "NOT_RUN").length} not run
              </p>
            )}
            {s.review && (
              <div className="mt-3 rounded-lg border border-surface-border bg-surface-elevated p-3">
                <p className="flex items-center gap-1.5 text-[12.5px] text-foreground">
                  <UserDot user={s.review.reviewer} size={18} />
                  <span className="font-medium">{s.review.reviewer.displayName}</span>
                  <span className="text-muted-foreground">
                    {s.review.decision === "APPROVED" ? "approved" : "requested changes"} · {fmtDateTime(s.review.reviewedAt)}
                  </span>
                </p>
                {s.review.comment && <p className="mt-1.5 text-[13px] whitespace-pre-wrap text-foreground/85">{s.review.comment}</p>}
                {s.review.exceptionReason && (
                  <p className="mt-1.5 text-[12.5px] text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Test exception:</span> {s.review.exceptionReason}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Discussion({
  comments,
  value,
  setValue,
  busy,
  onPost,
}: {
  comments: WorkItemDetail["item"]["comments"];
  value: string;
  setValue: (v: string) => void;
  busy: boolean;
  onPost: () => void;
}) {
  return (
    <div className="space-y-5">
      {comments.length === 0 && <p className="text-[13px] text-muted-foreground">No comments yet. Questions and decisions about this item go here.</p>}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <UserDot user={c.author} size={26} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-muted-foreground">
              <span className="font-medium text-foreground">{c.author.displayName}</span> · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
            </p>
            <p className="text-[13.5px] whitespace-pre-wrap text-foreground/90 mt-1 leading-relaxed">{c.body}</p>
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-surface-border bg-surface-elevated focus-within:border-primary/50 focus-within:shadow-ring transition-[border-color,box-shadow]">
        <textarea
          className="w-full min-h-[72px] bg-transparent px-3 py-2.5 text-[13px] outline-none resize-y placeholder:text-muted-foreground/60"
          placeholder="Write a comment… use @username to mention someone"
          value={value}
          maxLength={2000}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && value.trim()) onPost();
          }}
        />
        <div className="flex items-center justify-between px-3 pb-2.5">
          <span className="text-[11.5px] text-muted-foreground">Ctrl + Enter to post</span>
          <Button size="sm" variant="primary" disabled={busy || !value.trim()} onClick={onPost}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

function Activity({ audits }: { audits: WorkItemDetail["audits"] }) {
  if (audits.length === 0) return <p className="text-[13px] text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-4">
      {audits.map((a) => (
        <li key={a.id} className="flex gap-3 text-[13px]">
          <UserDot user={a.actor} size={20} />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{a.actor.displayName}</span> {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
              {a.summary && a.action !== "COMMENTED" ? <span className="text-foreground/80"> — {a.summary}</span> : null}
              {a.isOverride && <span className="ml-2 text-[11.5px] font-medium text-red-600 dark:text-red-400">admin override</span>}
            </p>
            {a.action === "COMMENTED" && a.summary && <p className="text-muted-foreground/80 mt-0.5">“{a.summary}”</p>}
            {a.reason && <p className="text-muted-foreground/90 mt-0.5">Reason: {a.reason}</p>}
            <ChangeDiff before={a.before} after={a.after} />
          </div>
          <span className="text-[12px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
        </li>
      ))}
    </ol>
  );
}

/** Compact, human-readable before → after for audit rows. */
function ChangeDiff({ before, after }: { before: unknown; after: unknown }) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = Object.keys(a).filter((k) => k in b && JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !k.endsWith("Id"));
  if (keys.length === 0) return null;
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v).replace(/_/g, " ").toLowerCase());
  return <p className="text-[12px] text-muted-foreground/80 mt-0.5">{keys.map((k) => `${k}: ${show(b[k])} → ${show(a[k])}`).join(" · ")}</p>;
}
