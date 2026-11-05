"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bug, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
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

/** Pass ✓ · Fail ✕ · Blocked ⊘ · Not run ○ */
function ResultIcon({ result }: { result: TestResult }) {
  const color = TEST_RESULT_COLOR[result];
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" className="shrink-0" aria-label={TEST_RESULT_LABEL[result]}>
      {result === "PASS" ? (
        <>
          <circle cx="7" cy="7" r="6.25" fill={color} />
          <path d="M4.3 7.2 6.2 9l3.5-3.8" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : result === "FAIL" ? (
        <>
          <circle cx="7" cy="7" r="6.25" fill={color} />
          <path d="m4.8 4.8 4.4 4.4M9.2 4.8 4.8 9.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : result === "BLOCKED" ? (
        <>
          <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeWidth="1.5" />
          <path d="M3.2 10.8 10.8 3.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="7" cy="7" r="6" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="1.6 1.9" />
      )}
    </svg>
  );
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

  const total = cases.length;
  const order: TestResult[] = ["PASS", "FAIL", "BLOCKED", "NOT_RUN"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1 max-w-md">
          <p className="text-[12.5px] text-muted-foreground tabular-nums">
            {total === 0
              ? "No test cases yet"
              : order
                  .filter((r) => counts[r])
                  .map((r) => `${counts[r]} ${TEST_RESULT_LABEL[r].toLowerCase()}`)
                  .join(" · ")}
          </p>
          {total > 0 && (
            <div className="mt-2 flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-foreground/[0.06]" aria-hidden="true">
              {order.map((r) =>
                counts[r] ? <div key={r} style={{ width: `${((counts[r] ?? 0) / total) * 100}%`, background: r === "NOT_RUN" ? "hsl(var(--muted-foreground) / 0.35)" : TEST_RESULT_COLOR[r] }} /> : null
              )}
            </div>
          )}
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add test case
          </Button>
        )}
      </div>

      {cases.length === 0 ? (
        <EmptyBlock>Add the scenarios you'll verify — each one records expected and actual results.</EmptyBlock>
      ) : (
        <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
          {cases.map((c) => {
            const isOpen = open[c.id];
            const result = c.result as TestResult;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 min-h-[46px] py-2 text-left hover:bg-surface-hover/60 transition-colors"
                  onClick={() => setOpen((p) => ({ ...p, [c.id]: !p[c.id] }))}
                  aria-expanded={!!isOpen}
                >
                  <ResultIcon result={result} />
                  <span className="flex-1 min-w-0 text-[13.5px] text-foreground truncate">{c.title}</span>
                  {!c.isMandatory && <span className="text-[11px] text-muted-foreground border border-surface-border rounded px-1.5 h-5 inline-flex items-center">Optional</span>}
                  {openBugCaseIds.has(c.id) && <Bug size={13} className="text-orange-500 shrink-0" aria-label="Open bug" />}
                  <span className="hidden sm:block w-16 text-right text-[12.5px] text-muted-foreground">{TEST_RESULT_LABEL[result]}</span>
                  <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-4">
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-[13px]">
                      {([
                        ["Preconditions", c.preconditions],
                        ["Steps", c.steps],
                        ["Expected result", c.expected],
                        ["Actual result", c.actual],
                      ] as [string, string | null][])
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[12px] text-muted-foreground">{k}</dt>
                            <dd className="whitespace-pre-wrap text-foreground/90 mt-0.5">{v}</dd>
                          </div>
                        ))}
                    </dl>
                    {(c.environment || c.buildVersion || c.testedAt || c.evidenceUrl) && (
                      <p className="text-[12.5px] text-muted-foreground">
                        {[c.environment, c.buildVersion && `build ${c.buildVersion}`, c.testedAt && `tested ${fmtDateTime(c.testedAt)}`].filter(Boolean).join(" · ")}
                        {c.evidenceUrl && (
                          <>
                            {" · "}
                            <SafeLink href={c.evidenceUrl} className="text-foreground hover:underline underline-offset-2">
                              Evidence ↗
                            </SafeLink>
                          </>
                        )}
                      </p>
                    )}

                    {(canEdit || (isTester && result === "FAIL")) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit && canRecord && <RecordResult testCase={c} onChanged={onChanged} />}
                        {isTester &&
                          result === "FAIL" &&
                          (openBugCaseIds.has(c.id) ? (
                            <span className="text-[12.5px] text-orange-600 dark:text-orange-400 inline-flex items-center gap-1.5">
                              <Bug size={13} /> A bug is open for this failure
                            </span>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => setBugFor(c)}>
                              <Bug size={13} /> File a bug
                            </Button>
                          ))}
                        {canEdit && (
                          <span className="ml-auto flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                              <Pencil size={13} /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Remove test case"
                              onClick={async () => {
                                if (!confirm("Remove this test case?")) return;
                                const r = await deleteTestCase({ testCaseId: c.id });
                                if (!r.success) return toast.error(r.error);
                                onChanged();
                              }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
