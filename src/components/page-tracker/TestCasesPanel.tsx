"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bug, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  TEST_RESULT_COLOR,
  TEST_RESULT_LABEL,
  type TestResult,
} from "@/lib/page-tracker/constants";
import {
  addTestCase,
  deleteTestCase,
  recordTestResult,
  updateTestCase,
} from "@/server/actions/tracker-test.actions";
import {
  EmptyBlock,
  Modal,
  Pill,
  SafeLink,
  btnGhost,
  btnPrimary,
  fmtDateTime,
  inputCls,
  labelCls,
  type Member,
} from "./ui";
import { CreateBugModal } from "./BugComponents";

export interface TestCaseRow {
  id: string;
  title: string;
  preconditions: string | null;
  steps: string | null;
  expected: string | null;
  actual: string | null;
  result: string;
  isMandatory: boolean;
  environment: string | null;
  buildVersion: string | null;
  evidenceUrl: string | null;
  testedAt: Date | null;
}

export function TestCasesPanel({
  workItemId,
  pageId,
  cases,
  canEdit,
  canRecord,
  isTester,
  openBugCaseIds,
  devItems,
  members,
  onChanged,
}: {
  workItemId: string;
  pageId: string;
  cases: TestCaseRow[];
  canEdit: boolean;
  /** Item must be In Progress to record execution results. */
  canRecord: boolean;
  isTester: boolean;
  openBugCaseIds: Set<string>;
  devItems: { id: string; title: string }[];
  members: Member[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TestCaseRow | null>(null);
  const [bugFor, setBugFor] = useState<TestCaseRow | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const counts = cases.reduce(
    (a, c) => ({ ...a, [c.result]: (a[c.result as TestResult] ?? 0) + 1 }),
    {} as Partial<Record<TestResult, number>>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TEST_RESULT_LABEL) as TestResult[]).map((r) => (
            <Pill key={r} color={TEST_RESULT_COLOR[r]}>
              {TEST_RESULT_LABEL[r]} {counts[r] ?? 0}
            </Pill>
          ))}
        </div>
        {canEdit && (
          <button className={btnGhost} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add test case
          </button>
        )}
      </div>

      {cases.length === 0 ? (
        <EmptyBlock>No test cases yet. Add the scenarios you will verify.</EmptyBlock>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => {
            const isOpen = open[c.id];
            const result = c.result as TestResult;
            return (
              <div key={c.id} className="rounded-xl border border-surface-border bg-surface-base">
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="flex-1 text-[13px] font-semibold text-foreground">{c.title}</span>
                  {!c.isMandatory && <Pill color="#9AA1AE">Optional</Pill>}
                  <Pill color={TEST_RESULT_COLOR[result]}>{TEST_RESULT_LABEL[result]}</Pill>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3.5 space-y-3 text-[12.5px] border-t border-surface-border pt-3">
                    {([
                      ["Preconditions", c.preconditions],
                      ["Steps", c.steps],
                      ["Expected result", c.expected],
                      ["Actual result", c.actual],
                    ] as [string, string | null][])
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[12px] font-medium text-muted-foreground">{k}</p>
                          <p className="whitespace-pre-wrap text-foreground/90">{v}</p>
                        </div>
                      ))}
                    {(c.environment || c.buildVersion || c.testedAt) && (
                      <p className="text-muted-foreground">
                        {[c.environment, c.buildVersion && `build ${c.buildVersion}`, c.testedAt && `tested ${fmtDateTime(c.testedAt)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {c.evidenceUrl && (
                      <SafeLink href={c.evidenceUrl} className="text-primary hover:underline">
                        Evidence ↗
                      </SafeLink>
                    )}

                    {canEdit && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {canRecord && <RecordResult testCase={c} onChanged={onChanged} />}
                        <button className={btnGhost} onClick={() => setEditing(c)}>
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className={btnGhost}
                          onClick={async () => {
                            if (!confirm("Remove this test case?")) return;
                            const r = await deleteTestCase({ testCaseId: c.id });
                            if (!r.success) return toast.error(r.error);
                            onChanged();
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                    {isTester && result === "FAIL" && (
                      openBugCaseIds.has(c.id) ? (
                        <p className="text-orange-500 text-[12px] flex items-center gap-1"><Bug size={12} /> A bug is open for this test case.</p>
                      ) : (
                        <button className={btnPrimary} onClick={() => setBugFor(c)}>
                          <Bug size={14} /> File bug from this failure
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <TestCaseForm
          title="Add test case"
          onClose={() => setAdding(false)}
          onSubmit={async (v) => {
            const r = await addTestCase({ workItemId, testCase: v });
            if (!r.success) return toast.error(r.error), false;
            onChanged();
            return true;
          }}
        />
      )}
      {editing && (
        <TestCaseForm
          title="Edit test case"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const r = await updateTestCase({ testCaseId: editing.id, changes: v });
            if (!r.success) return toast.error(r.error), false;
            onChanged();
            return true;
          }}
        />
      )}
      {bugFor && (
        <CreateBugModal
          pageId={pageId}
          devItems={devItems}
          members={members}
          testCase={bugFor}
          onClose={() => setBugFor(null)}
          onDone={() => {
            setBugFor(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function TestCaseForm({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: TestCaseRow;
  onClose: () => void;
  onSubmit: (v: {
    title: string;
    preconditions: string;
    steps: string;
    expected: string;
    isMandatory: boolean;
  }) => Promise<boolean | void>;
}) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    preconditions: initial?.preconditions ?? "",
    steps: initial?.steps ?? "",
    expected: initial?.expected ?? "",
    isMandatory: initial?.isMandatory ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={title} onClose={onClose} wide>
      <form
        className="space-y-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await onSubmit(f);
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <div>
          <label className={labelCls}>Scenario</label>
          <input className={inputCls} required autoFocus maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Filter by category shows only matching products" />
        </div>
        <div>
          <label className={labelCls}>Preconditions</label>
          <textarea className={`${inputCls} min-h-[52px]`} value={f.preconditions} maxLength={2000} onChange={(e) => set("preconditions", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Steps</label>
          <textarea className={`${inputCls} min-h-[80px]`} value={f.steps} maxLength={4000} onChange={(e) => set("steps", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Expected result</label>
          <textarea className={`${inputCls} min-h-[52px]`} value={f.expected} maxLength={2000} onChange={(e) => set("expected", e.target.value)} />
        </div>
        <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isMandatory} onChange={(e) => set("isMandatory", e.target.checked)} />
          Mandatory — must pass before the testing item can be approved
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !f.title.trim()}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RecordResult({ testCase, onChanged }: { testCase: TestCaseRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    result: (testCase.result === "NOT_RUN" ? "PASS" : testCase.result) as TestResult,
    actual: testCase.actual ?? "",
    environment: testCase.environment ?? "",
    buildVersion: testCase.buildVersion ?? "",
    evidenceUrl: testCase.evidenceUrl ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>Record result</button>
      {open && (
        <Modal title={`Result — ${testCase.title}`} onClose={() => setOpen(false)}>
          <form
            className="space-y-3.5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await recordTestResult({
                testCaseId: testCase.id,
                result: f.result,
                actual: f.actual || null,
                environment: f.environment || null,
                buildVersion: f.buildVersion || null,
                evidenceUrl: f.evidenceUrl || null,
              });
              setBusy(false);
              if (!r.success) return toast.error(r.error);
              toast.success("Result recorded");
              setOpen(false);
              onChanged();
            }}
          >
            <div>
              <label className={labelCls}>Result</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(TEST_RESULT_LABEL) as TestResult[]).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => set("result", r)}
                    className="px-2 py-2 rounded-xl text-[12px] font-semibold border transition-colors"
                    style={
                      f.result === r
                        ? { color: "#fff", background: TEST_RESULT_COLOR[r], borderColor: TEST_RESULT_COLOR[r] }
                        : { color: TEST_RESULT_COLOR[r], borderColor: `${TEST_RESULT_COLOR[r]}55`, background: "transparent" }
                    }
                  >
                    {TEST_RESULT_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            {testCase.expected && (
              <p className="text-[12px] text-muted-foreground">
                <b>Expected:</b> {testCase.expected}
              </p>
            )}
            <div>
              <label className={labelCls}>Actual result {(f.result === "FAIL" || f.result === "BLOCKED") && <span className="text-red-500">(required)</span>}</label>
              <textarea className={`${inputCls} min-h-[80px]`} value={f.actual} maxLength={4000} onChange={(e) => set("actual", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Environment / device</label>
                <input className={inputCls} maxLength={200} value={f.environment} onChange={(e) => set("environment", e.target.value)} placeholder="Chrome 126 · iPhone 14" />
              </div>
              <div>
                <label className={labelCls}>Build / version</label>
                <input className={inputCls} maxLength={100} value={f.buildVersion} onChange={(e) => set("buildVersion", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Screenshot / recording link</label>
              <input className={inputCls} value={f.evidenceUrl} placeholder="https://…" onChange={(e) => set("evidenceUrl", e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btnPrimary} disabled={busy}>{busy ? "Saving…" : "Save result"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
