"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Layers, AlertTriangle, ClipboardCheck, Clock } from "lucide-react";
import type { getTrackerOverview } from "@/lib/page-tracker/queries";
import {
  ACTION_LABEL,
  LIFECYCLE_COLOR,
  LIFECYCLE_LABEL,
  SEVERITY_COLOR,
  STATUS_COLOR,
  STATUS_LABEL,
  WORKSTREAMS,
  WORKSTREAM_COLOR,
  WORKSTREAM_LABEL,
  type PageLifecycle,
  type Priority,
  type Workstream,
  type WorkItemStatus,
} from "@/lib/page-tracker/constants";
import { createPage } from "@/server/actions/tracker-page.actions";
import { Button, EmptyState, StatCard, StatGroup, type Tone } from "@/components/ui";
import {
  EmptyBlock,
  Meter,
  Modal,
  Pill,
  PriorityBadge,
  UserChip,
  UserSelect,
  btnPrimary,
  cardCls,
  fmtDate,
  inputCls,
  isLeadRole,
  isoFromDateInput,
  labelCls,
  type Member,
  type Viewer,
} from "./ui";

type Overview = Awaited<ReturnType<typeof getTrackerOverview>>;

// Page · priority · design · development · testing · owner (+ target) · status
const PAGE_GRID = "grid-cols-[minmax(220px,1.6fr)_84px_repeat(3,minmax(120px,1fr))_150px_168px]";

function streamState(s: Overview["pages"][number]["streams"][Workstream]) {
  if (s.total === 0) return { label: s.required ? "No items" : "Not required", color: "#9AA1AE" };
  if (s.blocked > 0) return { label: "Blocked", color: "#D1495B" };
  if (s.complete) return { label: "Done", color: "#1EAE7C" };
  if (s.inReview > 0) return { label: "In review", color: "#A855F7" };
  if (s.changes > 0) return { label: "Changes requested", color: "#F59E0B" };
  if (s.started) return { label: "In progress", color: "#3B82F6" };
  return { label: "Not started", color: "#9AA1AE" };
}

export function PageTrackerClient({
  overview,
  projectName,
  viewer,
  members,
}: {
  overview: Overview;
  projectName: string;
  viewer: Viewer;
  members: Member[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [priority, setPriority] = useState("all");
  const [workstream, setWorkstream] = useState("all");
  const [creating, setCreating] = useState(false);
  const lead = isLeadRole(viewer);

  const pages = useMemo(
    () =>
      overview.pages.filter((p) => {
        if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (status !== "all" && p.lifecycle !== status) return false;
        if (owner !== "all" && p.owner?.id !== owner) return false;
        if (priority !== "all" && p.priority !== priority) return false;
        if (workstream !== "all") {
          const s = p.streams[workstream as Workstream];
          if (s.total - s.done === 0) return false; // only pages with open work in that stream
        }
        return true;
      }),
    [overview.pages, q, status, owner, priority, workstream]
  );

  const s = overview.summary;
  const tiles: { label: string; value: number; tone: Tone; icon: React.ReactNode }[] = [
    { label: "Pages / modules", value: s.total, tone: "primary", icon: <Layers size={15} /> },
    { label: "In progress", value: s.inProgress, tone: "info", icon: <Clock size={15} /> },
    { label: "Completed", value: s.completed, tone: "success", icon: <ClipboardCheck size={15} /> },
    { label: "Blocked", value: s.blocked, tone: "danger", icon: <AlertTriangle size={15} /> },
    { label: "Pending reviews", value: s.pendingReviews, tone: "purple", icon: <ClipboardCheck size={15} /> },
    { label: "Overdue items", value: s.overdue, tone: "warning", icon: <AlertTriangle size={15} /> },
  ];

  const statusTotal = Object.values(overview.byStatus).reduce((a, b) => a + b, 0);
  const bugTotal = Object.values(overview.bugsBySeverity).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-muted-foreground">{projectName}</p>
          <h1 className="text-[20px] font-semibold text-foreground tracking-[-0.015em] mt-0.5">Pages &amp; modules</h1>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-xl">
            Design, development and testing for every page — with a named owner and a reviewer on every item.
          </p>
        </div>
        {lead && (
          <button className={btnPrimary} onClick={() => setCreating(true)}>
            <Plus size={14} /> New page / module
          </button>
        )}
      </div>

      {/* Summary */}
      <StatGroup className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <StatCard key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />
        ))}
      </StatGroup>

      {/* Dashboard */}
      {s.total > 0 && (
        <section className="grid grid-cols-1 xl:grid-cols-3 border-y border-surface-border divide-y xl:divide-y-0 xl:divide-x divide-surface-border">
          <div className="py-5 xl:pr-8">
            <p className="text-[13px] font-semibold text-foreground mb-4">Work items by status</p>
            {statusTotal === 0 ? (
              <p className="text-[12px] text-muted-foreground">No work items yet.</p>
            ) : (
              <>
                <div className="flex h-2 gap-0.5 rounded-full overflow-hidden bg-foreground/[0.06]">
                  {(Object.keys(STATUS_LABEL) as WorkItemStatus[])
                    .filter((k) => overview.byStatus[k])
                    .map((k) => (
                      <div
                        key={k}
                        title={`${STATUS_LABEL[k]}: ${overview.byStatus[k]}`}
                        style={{ width: `${(overview.byStatus[k] / statusTotal) * 100}%`, background: STATUS_COLOR[k] }}
                      />
                    ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                  {(Object.keys(STATUS_LABEL) as WorkItemStatus[])
                    .filter((k) => overview.byStatus[k])
                    .map((k) => (
                      <span key={k} className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                        {STATUS_LABEL[k]} <span className="text-foreground tabular-nums">{overview.byStatus[k]}</span>
                      </span>
                    ))}
                </div>
              </>
            )}
          </div>

          <div className="py-5 xl:px-8">
            <p className="text-[13px] font-semibold text-foreground mb-4">Workstream progress</p>
            <div className="space-y-3">
              {WORKSTREAMS.map((w) => {
                const d = overview.workstreams[w];
                return (
                  <div key={w}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="font-medium text-foreground">{WORKSTREAM_LABEL[w]}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {d.done}/{d.total} done
                      </span>
                    </div>
                    <Meter done={d.done} total={d.total} color={WORKSTREAM_COLOR[w]} />
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-4">
              Progress is informational — a page is complete only when every required item is approved.
            </p>
          </div>

          <div className="py-5 xl:pl-8">
            <p className="text-[13px] font-semibold text-foreground mb-4">
              Open bugs by severity
            </p>
            {bugTotal === 0 ? (
              <p className="text-[12px] text-muted-foreground">No open bugs.</p>
            ) : (
              <div className="space-y-2">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="text-[11.5px] w-16 text-muted-foreground">{sev[0] + sev.slice(1).toLowerCase()}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((overview.bugsBySeverity[sev] ?? 0) / bugTotal) * 100}%`,
                          background: SEVERITY_COLOR[sev],
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums w-5 text-right">
                      {overview.bugsBySeverity[sev] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-8`}
            placeholder="Search pages and modules…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={`${inputCls} flex-1 sm:flex-none sm:!w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {(Object.keys(LIFECYCLE_LABEL) as PageLifecycle[]).map((k) => (
            <option key={k} value={k}>
              {LIFECYCLE_LABEL[k]}
            </option>
          ))}
        </select>
        <select className={`${inputCls} flex-1 sm:flex-none sm:!w-auto`} value={workstream} onChange={(e) => setWorkstream(e.target.value)}>
          <option value="all">Any workstream</option>
          {WORKSTREAMS.map((w) => (
            <option key={w} value={w}>
              Open {WORKSTREAM_LABEL[w]} work
            </option>
          ))}
        </select>
        <select className={`${inputCls} flex-1 sm:flex-none sm:!w-auto`} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">Any owner</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <select className={`${inputCls} flex-1 sm:flex-none sm:!w-auto`} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">Any priority</option>
          {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {p[0] + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Page cards */}
      {overview.pages.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="No pages tracked yet"
          description={
            lead
              ? "Create a page or module (e.g. “Login” or “Payments”), then add Design, Development and Testing work items to it."
              : "A lead or admin will create the pages the team works on."
          }
          action={
            lead ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={15} /> New page / module
              </Button>
            ) : undefined
          }
        />
      ) : pages.length === 0 ? (
        <EmptyBlock>No pages match these filters.</EmptyBlock>
      ) : (
        <div className="rounded-xl border border-surface-border overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={`grid ${PAGE_GRID} gap-4 px-4 h-9 items-center text-[12px] text-muted-foreground border-b border-surface-border`}>
              <span>Page</span>
              <span>Priority</span>
              {WORKSTREAMS.map((w) => (
                <span key={w}>{WORKSTREAM_LABEL[w]}</span>
              ))}
              <span>Owner · target</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-surface-border">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link href={`/page-tracker/${p.id}`} className={`grid ${PAGE_GRID} gap-4 px-4 py-3 items-center hover:bg-surface-hover/60 transition-colors`}>
                    {/* Name + signals */}
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-[11px] text-muted-foreground border border-surface-border rounded px-1 h-[18px] inline-flex items-center">
                          {p.type === "MODULE" ? "Module" : "Page"}
                        </span>
                        <span className="text-[13.5px] font-medium text-foreground truncate">{p.name}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground tabular-nums whitespace-nowrap" title={`Last activity ${formatDistanceToNow(new Date(p.lastActivity), { addSuffix: true })}`}>
                        <span>{p.openItems} open</span>
                        {p.pendingReviews > 0 && <span className="text-purple-600 dark:text-purple-400">{p.pendingReviews} in review</span>}
                        {p.overdue > 0 && <span className="text-red-600 dark:text-red-400">{p.overdue} overdue</span>}
                        {p.openBugs > 0 && (
                          <span className="text-orange-600 dark:text-orange-400">
                            {p.openBugs} bug{p.openBugs > 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                    </span>

                    <span>
                      <PriorityBadge priority={p.priority as Priority} />
                    </span>

                    {/* Three separate workstream states — never one blended percentage */}
                    {WORKSTREAMS.map((w) => {
                      const st = p.streams[w];
                      const state = streamState(st);
                      return (
                        <span key={w} className="min-w-0">
                          <span className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: state.color }} />
                              <span className="truncate text-foreground/85">{state.label}</span>
                            </span>
                            {st.total > 0 && <span className="text-muted-foreground tabular-nums shrink-0">{st.done}/{st.total}</span>}
                          </span>
                          <span className="block mt-1.5">
                            <Meter done={st.done} total={st.total} color={WORKSTREAM_COLOR[w]} />
                          </span>
                        </span>
                      );
                    })}

                    <span className="min-w-0">
                      <UserChip user={p.owner} empty="No owner" />
                      <span className="block text-[12px] text-muted-foreground tabular-nums mt-1">{p.targetDate ? `Target ${fmtDate(p.targetDate)}` : "No target date"}</span>
                    </span>
                    <span className="flex justify-end min-w-0 [&>span]:max-w-full [&>span]:truncate">
                      <Pill color={LIFECYCLE_COLOR[p.lifecycle as PageLifecycle]}>{LIFECYCLE_LABEL[p.lifecycle as PageLifecycle]}</Pill>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {overview.recent.length > 0 && (
        <section>
          <h3 className="text-[14px] font-semibold text-foreground mb-3">Recent activity</h3>
          <ul className="rounded-xl border border-surface-border divide-y divide-surface-border">
            {overview.recent.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-[13px] text-muted-foreground flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-medium text-foreground">{a.actor.displayName}</span>
                <span>{ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}</span>
                {a.page && (
                  <Link href={`/page-tracker/${a.page.id}`} className="text-primary hover:underline">
                    {a.page.name}
                  </Link>
                )}
                {a.isOverride && <Pill color="#D1495B">admin override</Pill>}
                <span className="text-[12px] ml-auto">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && <CreatePageModal members={members} onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreatePageModal({ members, onClose }: { members: Member[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    description: "",
    type: "PAGE" as "PAGE" | "MODULE",
    priority: "MEDIUM" as Priority,
    ownerId: "",
    targetDate: "",
    designRequired: true,
    developmentRequired: true,
    testingRequired: true,
    requireFinalApproval: false,
    membersCanCreate: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createPage({
      name: f.name,
      description: f.description || null,
      type: f.type,
      priority: f.priority,
      ownerId: f.ownerId || null,
      targetDate: isoFromDateInput(f.targetDate),
      designRequired: f.designRequired,
      developmentRequired: f.developmentRequired,
      testingRequired: f.testingRequired,
      requireFinalApproval: f.requireFinalApproval,
      membersCanCreate: f.membersCanCreate,
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Page created");
    router.push(`/page-tracker/${r.data.id}`);
  };

  const Check = ({ k, label, hint }: { k: keyof typeof f; label: string; hint?: string }) => (
    <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 accent-[hsl(var(--primary))]"
        checked={f[k] as boolean}
        onChange={(e) => set(k, e.target.checked as never)}
      />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[11.5px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <Modal title="New page / module" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
          <div>
            <label className={labelCls}>Name</label>
            <input
              className={inputCls}
              autoFocus
              required
              maxLength={100}
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Product Listing"
            />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value as "PAGE" | "MODULE")}>
              <option value="PAGE">Page</option>
              <option value="MODULE">Module</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Scope / description</label>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            maxLength={2000}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Priority</label>
            <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {p[0] + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Page owner</label>
            <UserSelect users={members} value={f.ownerId} onChange={(v) => set("ownerId", v)} emptyLabel="None" />
          </div>
          <div>
            <label className={labelCls}>Target date</label>
            <input type="date" className={inputCls} value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-base p-3.5 space-y-2.5">
          <p className="text-[12px] font-medium text-muted-foreground">Completion rules</p>
          <Check k="designRequired" label="Design is required" />
          <Check k="developmentRequired" label="Development is required" />
          <Check k="testingRequired" label="Testing is required" />
          <Check
            k="requireFinalApproval"
            label="Require final release approval"
            hint="Even when all work is done, a lead signs off before the page counts as Completed."
          />
          <Check
            k="membersCanCreate"
            label="Team members can add work items"
            hint="Members may create items assigned to themselves; leads still control assignment."
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnPrimary + " !bg-surface-base !text-foreground border border-surface-border"} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} disabled={busy || !f.name.trim()}>
            {busy ? "Creating…" : "Create page"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
