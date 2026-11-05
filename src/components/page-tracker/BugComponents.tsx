"use client";

import { ImageTextarea, RichText } from "@/components/shared/ImageAttachments";
import { useState } from "react";
import { toast } from "sonner";
import { Bug, Plus } from "lucide-react";
import { Button, Segmented } from "@/components/ui";
import {
  BUG_RESOLVED,
  BUG_STATUS_LABEL,
  SEVERITY_COLOR,
  type BugSeverity,
  type BugStatus,
  type Priority,
} from "@/lib/page-tracker/constants";
import {
  createBug,
  retestBug,
  startBugFix,
  submitBugForRetest,
  triageBug,
} from "@/server/actions/tracker-test.actions";
import {
  EmptyBlock,
  Modal,
  Pill,
  SafeLink,
  UserChip,
  UserSelect,
  btnGhost,
  btnPrimary,
  cardCls,
  fmtDate,
  inputCls,
  isLeadRole,
  labelCls,
  type Member,
  type Person,
  type Viewer,
} from "./ui";

export interface BugRow {
  id: string;
  title: string;
  description: string | null;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  severity: string;
  priority: string;
  status: string;
  releaseBlocking: boolean;
  environment: string | null;
  buildVersion: string | null;
  evidenceUrl: string | null;
  createdAt: Date;
  assigneeId: string | null;
  reporterId: string;
  devWorkItemId: string | null;
  testWorkItemId: string | null;
  assignee: Person | null;
  reporter: Person;
  testCase?: { id: string; title: string } | null;
  testWorkItem?: { id: string; title: string; assigneeId: string } | null;
  devWorkItem?: { id: string; title: string } | null;
}

const BUG_STATUS_COLOR: Record<BugStatus, string> = {
  OPEN: "#D1495B",
  TRIAGED: "#F59E0B",
  ASSIGNED: "#3B82F6",
  IN_PROGRESS: "#3B82F6",
  READY_FOR_RETEST: "#A855F7",
  RETEST_FAILED: "#D1495B",
  VERIFIED: "#1EAE7C",
  CLOSED: "#6B7280",
  WONT_FIX: "#6B7280",
  DUPLICATE: "#6B7280",
};

export function BugsPanel({
  pageId,
  archived,
  bugs,
  devItems,
  viewer,
  members,
  onChanged,
  onOpenItem,
}: {
  pageId: string;
  archived: boolean;
  bugs: BugRow[];
  devItems: { id: string; title: string }[];
  viewer: Viewer;
  members: Member[];
  onChanged: () => void;
  onOpenItem?: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [reporting, setReporting] = useState(false);
  const shown = bugs.filter((b) => filter === "all" || !BUG_RESOLVED.includes(b.status as BugStatus));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `Open ${bugs.filter((b) => !BUG_RESOLVED.includes(b.status as BugStatus)).length}` },
            { value: "all", label: `All ${bugs.length}` },
          ]}
        />
        {!archived && (
          <Button onClick={() => setReporting(true)}>
            <Plus size={14} /> Report a bug
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <EmptyBlock>{filter === "open" ? "No open bugs." : "No bugs recorded."}</EmptyBlock>
      ) : (
        <div className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
          {shown.map((b) => (
            <BugCard key={b.id} bug={b} viewer={viewer} members={members} devItems={devItems} onChanged={onChanged} onOpenItem={onOpenItem} />
          ))}
        </div>
      )}
      {reporting && (
        <CreateBugModal
          pageId={pageId}
          devItems={devItems}
          members={members}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

export function BugCard({
  bug,
  viewer,
  members,
  devItems,
  onChanged,
  onOpenItem,
}: {
  bug: BugRow;
  viewer: Viewer;
  members: Member[];
  devItems: { id: string; title: string }[];
  onChanged: () => void;
  onOpenItem?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [triage, setTriage] = useState(false);
  const [retest, setRetest] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lead = isLeadRole(viewer);
  const status = bug.status as BugStatus;
  const isAssignee = bug.assigneeId === viewer.id;
  const isTester = bug.reporterId === viewer.id || bug.testWorkItem?.assigneeId === viewer.id;
  const resolved = BUG_RESOLVED.includes(status);

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, msg: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) return toast.error(r.error ?? "Failed");
    toast.success(msg);
    onChanged();
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span
          className="mt-[5px] w-2 h-2 rounded-full shrink-0"
          style={{ background: SEVERITY_COLOR[bug.severity as BugSeverity] }}
          title={`${bug.severity[0] + bug.severity.slice(1).toLowerCase()} severity`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className={`text-[14px] font-medium ${resolved ? "text-muted-foreground" : "text-foreground"}`}>{bug.title}</p>
            <span className="flex items-center gap-2 text-[12.5px] whitespace-nowrap">
              {bug.releaseBlocking && !resolved && <span className="text-red-600 dark:text-red-400 font-medium">Release-blocking</span>}
              <span className="inline-flex items-center gap-1.5 text-foreground/85">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: BUG_STATUS_COLOR[status] }} />
                {BUG_STATUS_LABEL[status]}
              </span>
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {bug.severity[0] + bug.severity.slice(1).toLowerCase()} · Dev: <span className="text-foreground/85">{bug.assignee?.displayName ?? "unassigned"}</span> · Reported by{" "}
            <span className="text-foreground/85">{bug.reporter.displayName}</span> · {fmtDate(bug.createdAt)}
            {bug.testCase && (
              <>
                {" "}
                · Test case <span className="text-foreground/85">{bug.testCase.title}</span>
              </>
            )}
          </p>
          {onOpenItem && (bug.devWorkItem || bug.testWorkItem) && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              {bug.devWorkItem && (
                <button type="button" className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2" onClick={() => onOpenItem(bug.devWorkItem!.id)}>
                  Fix in: {bug.devWorkItem.title}
                </button>
              )}
              {bug.testWorkItem && (
                <button type="button" className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2" onClick={() => onOpenItem(bug.testWorkItem!.id)}>
                  Found in: {bug.testWorkItem.title}
                </button>
              )}
            </p>
          )}

          {expanded && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[13px] rounded-lg bg-surface-base border border-surface-border p-3">
              {([
                ["Description", bug.description],
                ["Steps to reproduce", bug.stepsToReproduce],
                ["Expected", bug.expectedResult],
                ["Actual", bug.actualResult],
                ["Environment", [bug.environment, bug.buildVersion].filter(Boolean).join(" · ")],
              ] as [string, string | null][])
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className={k === "Description" || k === "Steps to reproduce" ? "sm:col-span-2" : ""}>
                    <p className="text-[12px] text-muted-foreground">{k}</p>
                    <RichText text={v} className="text-foreground/90 mt-0.5" />
                  </div>
                ))}
              {bug.evidenceUrl && (
                <SafeLink href={bug.evidenceUrl} className="text-foreground hover:underline underline-offset-2">
                  Evidence ↗
                </SafeLink>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide details" : "Show details"}
            </button>
            {((isAssignee && ["OPEN", "TRIAGED", "ASSIGNED", "RETEST_FAILED", "IN_PROGRESS"].includes(status)) || (isTester && status === "READY_FOR_RETEST") || (lead && (!resolved || status === "VERIFIED"))) && (
              <span className="ml-auto flex flex-wrap gap-2">
                {isAssignee && ["OPEN", "TRIAGED", "ASSIGNED", "RETEST_FAILED"].includes(status) && (
                  <Button size="sm" variant="primary" loading={busy} onClick={() => run(() => startBugFix({ bugId: bug.id }), "Bug in progress")}>
                    Start fix
                  </Button>
                )}
                {isAssignee && status === "IN_PROGRESS" && (
                  <Button size="sm" variant="primary" loading={busy} onClick={() => run(() => submitBugForRetest({ bugId: bug.id }), "Sent for retest")}>
                    Ready for retest
                  </Button>
                )}
                {isTester && status === "READY_FOR_RETEST" && (
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => setRetest(true)}>
                    Record retest
                  </Button>
                )}
                {lead && (!resolved || status === "VERIFIED") && (
                  <Button size="sm" disabled={busy} onClick={() => setTriage(true)}>
                    Triage
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {triage && (
        <TriageModal bug={bug} members={members} devItems={devItems} onClose={() => setTriage(false)} onSaved={() => { setTriage(false); onChanged(); }} />
      )}
      {retest && (
        <RetestModal bugId={bug.id} onClose={() => setRetest(false)} onSaved={() => { setRetest(false); onChanged(); }} />
      )}
    </div>
  );
}

function TriageModal({
  bug,
  members,
  devItems,
  onClose,
  onSaved,
}: {
  bug: BugRow;
  members: Member[];
  devItems: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    assigneeId: bug.assigneeId ?? "",
    devWorkItemId: bug.devWorkItemId ?? "",
    severity: bug.severity as BugSeverity,
    priority: bug.priority as Priority,
    releaseBlocking: bug.releaseBlocking,
    status: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const resolved = bug.status === "VERIFIED";

  const save = async () => {
    setBusy(true);
    const r = await triageBug({
      bugId: bug.id,
      changes: {
        ...(f.assigneeId !== (bug.assigneeId ?? "") && { assigneeId: f.assigneeId || null }),
        ...(f.devWorkItemId !== (bug.devWorkItemId ?? "") && { devWorkItemId: f.devWorkItemId || null }),
        ...(f.severity !== bug.severity && { severity: f.severity }),
        ...(f.priority !== bug.priority && { priority: f.priority }),
        ...(f.releaseBlocking !== bug.releaseBlocking && { releaseBlocking: f.releaseBlocking }),
        ...(f.status && { status: f.status as "OPEN" | "TRIAGED" | "CLOSED" | "WONT_FIX" | "DUPLICATE" }),
      },
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Bug updated");
    onSaved();
  };

  return (
    <Modal title="Triage bug" onClose={onClose}>
      <div className="space-y-3.5">
        {!resolved && (
          <>
            <div>
              <label className={labelCls}>Assigned developer</label>
              <UserSelect users={members.filter((m) => m.role !== "ADMIN")} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} emptyLabel="Unassigned" />
            </div>
            <div>
              <label className={labelCls}>Related development work item</label>
              <select className={inputCls} value={f.devWorkItemId} onChange={(e) => set("devWorkItemId", e.target.value)}>
                <option value="">None</option>
                {devItems.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Severity</label>
                <select className={inputCls} value={f.severity} onChange={(e) => set("severity", e.target.value as BugSeverity)}>
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as BugSeverity[]).map((s) => (
                    <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((s) => (
                    <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.releaseBlocking} onChange={(e) => set("releaseBlocking", e.target.checked)} />
              Blocks the page from being completed
            </label>
          </>
        )}
        <div>
          <label className={labelCls}>Set status</label>
          <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">Keep current ({BUG_STATUS_LABEL[bug.status as BugStatus]})</option>
            {!resolved && <option value="TRIAGED">Triaged</option>}
            {!resolved && <option value="OPEN">Open</option>}
            {!resolved && <option value="WONT_FIX">Won’t fix</option>}
            {!resolved && <option value="DUPLICATE">Duplicate</option>}
            {resolved && <option value="CLOSED">Closed</option>}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

function RetestModal({ bugId, onClose, onSaved }: { bugId: string; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const send = async (passed: boolean) => {
    setBusy(true);
    const r = await retestBug({ bugId, passed, note: note || null });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success(passed ? "Bug verified" : "Returned to the developer");
    onSaved();
  };
  return (
    <Modal title="Record retest" onClose={onClose}>
      <div className="space-y-3.5">
        <p className="text-[12.5px] text-muted-foreground">Run the failed scenario again, then record what happened.</p>
        <div>
          <label className={labelCls}>Notes (required if it still fails)</label>
          <ImageTextarea minHeight={90} value={note} maxLength={2000} onValueChange={(v) => setNote(v)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className="inline-flex items-center px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-[13px] font-semibold disabled:opacity-50" disabled={busy} onClick={() => send(false)}>
            Still fails
          </button>
          <button className={btnPrimary} disabled={busy} onClick={() => send(true)}>Passes — verify</button>
        </div>
      </div>
    </Modal>
  );
}

export function CreateBugModal({
  pageId,
  devItems,
  members,
  testCase,
  onClose,
  onDone,
}: {
  pageId: string;
  devItems: { id: string; title: string }[];
  members: Member[];
  testCase?: { id: string; title: string; expected?: string | null; actual?: string | null; steps?: string | null; environment?: string | null; buildVersion?: string | null; evidenceUrl?: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: testCase ? `Failed: ${testCase.title}` : "",
    description: "",
    stepsToReproduce: testCase?.steps ?? "",
    expectedResult: testCase?.expected ?? "",
    actualResult: testCase?.actual ?? "",
    severity: "MEDIUM" as BugSeverity,
    priority: "MEDIUM" as Priority,
    devWorkItemId: "",
    assigneeId: "",
    environment: testCase?.environment ?? "",
    buildVersion: testCase?.buildVersion ?? "",
    evidenceUrl: testCase?.evidenceUrl ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createBug({
      pageId,
      testCaseId: testCase?.id ?? null,
      title: f.title,
      description: f.description || null,
      stepsToReproduce: f.stepsToReproduce || null,
      expectedResult: f.expectedResult || null,
      actualResult: f.actualResult || null,
      severity: f.severity,
      priority: f.priority,
      devWorkItemId: f.devWorkItemId || null,
      assigneeId: f.assigneeId || null,
      environment: f.environment || null,
      buildVersion: f.buildVersion || null,
      evidenceUrl: f.evidenceUrl || null,
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Bug reported");
    onDone();
  };

  return (
    <Modal title={testCase ? "File bug from failed test" : "Report a bug"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Bug size={14} /> {testCase ? <>Linked to test case <b className="text-foreground/80">{testCase.title}</b></> : "Standalone bug on this page"}
        </div>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} required maxLength={200} autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <ImageTextarea minHeight={60} value={f.description} maxLength={4000} onValueChange={(v) => set("description", v)} />
        </div>
        <div>
          <label className={labelCls}>Steps to reproduce</label>
          <ImageTextarea minHeight={60} value={f.stepsToReproduce} maxLength={4000} onValueChange={(v) => set("stepsToReproduce", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Expected result</label>
            <ImageTextarea minHeight={56} value={f.expectedResult} maxLength={2000} onValueChange={(v) => set("expectedResult", v)} />
          </div>
          <div>
            <label className={labelCls}>Actual result</label>
            <ImageTextarea minHeight={56} value={f.actualResult} maxLength={2000} onValueChange={(v) => set("actualResult", v)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Severity</label>
            <select className={inputCls} value={f.severity} onChange={(e) => set("severity", e.target.value as BugSeverity)}>
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as BugSeverity[]).map((s) => (
                <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((s) => (
                <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Related development item</label>
            <select className={inputCls} value={f.devWorkItemId} onChange={(e) => set("devWorkItemId", e.target.value)}>
              <option value="">None</option>
              {devItems.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Assign developer</label>
            <UserSelect users={members.filter((m) => m.role !== "ADMIN")} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} emptyLabel="Default (dev item owner)" />
          </div>
          <div>
            <label className={labelCls}>Environment</label>
            <input className={inputCls} maxLength={200} value={f.environment} onChange={(e) => set("environment", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Build / version</label>
            <input className={inputCls} maxLength={100} value={f.buildVersion} onChange={(e) => set("buildVersion", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Evidence link (screenshot / recording)</label>
          <input className={inputCls} placeholder="https://…" value={f.evidenceUrl} onChange={(e) => set("evidenceUrl", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !f.title.trim()}>{busy ? "Reporting…" : "Report bug"}</button>
        </div>
      </form>
    </Modal>
  );
}
