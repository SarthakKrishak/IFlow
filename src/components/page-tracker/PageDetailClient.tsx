"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Settings2,
  CalendarDays,
  Lock,
  MessageSquare,
  Bug,
  Paperclip,
  ChevronUp,
  ChevronDown,
  Archive,
  CheckCircle2,
  CircleAlert,
  LayoutGrid,
  History,
  ExternalLink,
  Kanban,
} from "lucide-react";
import type { getPageDetail } from "@/lib/page-tracker/queries";
import {
  ACTION_LABEL,
  LIFECYCLE_COLOR,
  LIFECYCLE_LABEL,
  WORKSTREAMS,
  WORKSTREAM_COLOR,
  WORKSTREAM_LABEL,
  type Priority,
  type Workstream,
} from "@/lib/page-tracker/constants";
import { approveRelease, setPageArchived, updatePage } from "@/server/actions/tracker-page.actions";
import { createWorkItem, reorderWorkItem } from "@/server/actions/tracker-workitem.actions";
import {
  EmptyBlock,
  Meter,
  Modal,
  Pill,
  PriorityBadge,
  SafeLink,
  StatusBadge,
  UserChip,
  UserDot,
  UserSelect,
  btnGhost,
  btnPrimary,
  cardCls,
  fmtDate,
  inputCls,
  isLeadRole,
  isOverdue,
  isoFromDateInput,
  dateInputValue,
  labelCls,
  type Member,
  type Viewer,
} from "./ui";
import { WorkItemDrawer } from "./WorkItemDrawer";
import { BugsPanel } from "./BugComponents";

type Detail = NonNullable<Awaited<ReturnType<typeof getPageDetail>>>;
type PageItem = Detail["page"]["workItems"][number];

export function PageDetailClient({
  page,
  activity,
  life,
  boards,
  viewer,
  members,
  initialItemId,
  initialTab,
}: {
  page: Detail["page"];
  activity: Detail["activity"];
  life: Detail["life"];
  boards: { id: string; name: string }[];
  viewer: Viewer;
  members: Member[];
  initialItemId: string | null;
  initialTab: "board" | "bugs";
}) {
  const router = useRouter();
  const lead = isLeadRole(viewer);
  const [tab, setTab] = useState<"board" | "bugs" | "activity">(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [adding, setAdding] = useState<Workstream | null>(null);
  const [editing, setEditing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const canCreate = (assignSelfOnly: boolean) => !page.archivedAt && (lead || (page.membersCanCreate && assignSelfOnly));
  const [, startTransition] = useTransition();
  // Non-blocking: the UI stays interactive while fresh server data streams in.
  const refresh = () => startTransition(() => router.refresh());

  const open = (id: string | null) => {
    setSelectedId(id);
    // keep the URL shareable without triggering a server round-trip
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("item", id);
    else url.searchParams.delete("item");
    window.history.replaceState(null, "", url.toString());
  };

  const byStream = useMemo(() => {
    const m: Record<Workstream, PageItem[]> = { DESIGN: [], DEVELOPMENT: [], TESTING: [] };
    for (const i of page.workItems) {
      if (!showArchived && i.archivedAt) continue;
      if (mineOnly && i.assigneeId !== viewer.id && i.reviewerId !== viewer.id) continue;
      m[i.workstream as Workstream].push(i);
    }
    return m;
  }, [page.workItems, showArchived, mineOnly, viewer.id]);

  const archivedCount = page.workItems.filter((i) => i.archivedAt).length;
  const openBugs = page.bugs.filter((b) => !["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"].includes(b.status));
  const devItems = page.workItems
    .filter((i) => i.workstream === "DEVELOPMENT" && !i.archivedAt)
    .map((i) => ({ id: i.id, title: i.title }));
  const links = (Array.isArray(page.links) ? page.links : []) as { label: string; url: string }[];

  const doArchive = async () => {
    if (!confirm(page.archivedAt ? "Restore this page?" : "Archive this page? It will be hidden from the tracker (nothing is deleted).")) return;
    setBusy(true);
    const r = await setPageArchived({ pageId: page.id, archived: !page.archivedAt });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success(page.archivedAt ? "Page restored" : "Page archived");
    if (!page.archivedAt) router.push("/page-tracker");
    else refresh();
  };

  const doRelease = async () => {
    setBusy(true);
    const r = await approveRelease({ pageId: page.id });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Release approved");
    refresh();
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      <Link href="/page-tracker" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All pages
      </Link>

      {/* Header */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">
                {page.type === "MODULE" ? "Module" : "Page"}
              </span>
              <Pill color={LIFECYCLE_COLOR[life.lifecycle]}>{LIFECYCLE_LABEL[life.lifecycle]}</Pill>
              <PriorityBadge priority={page.priority as Priority} />
              {page.archivedAt && <Pill color="#6B7280">Archived</Pill>}
            </div>
            <h1 className="text-[22px] font-semibold text-foreground tracking-tight">{page.name}</h1>
            {page.description && (
              <p className="text-[13px] text-muted-foreground mt-1.5 max-w-3xl whitespace-pre-wrap">{page.description}</p>
            )}
          </div>
          {lead && (
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => setEditing(true)}>
                <Settings2 size={14} /> Settings
              </button>
              <button className={btnGhost} disabled={busy} onClick={doArchive}>
                <Archive size={14} /> {page.archivedAt ? "Restore" : "Archive"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
          <span className="flex items-center gap-2 text-muted-foreground">
            Owner: <UserChip user={page.owner} empty="none" />
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays size={14} /> Target: <b className="text-foreground">{fmtDate(page.targetDate)}</b>
          </span>
          {links.map((l, i) => (
            <SafeLink key={i} href={l.url} className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink size={12} /> {l.label || new URL(l.url).hostname}
            </SafeLink>
          ))}
        </div>

        {/* Per-stream summary + completion gate */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKSTREAMS.map((w) => {
            const s = life.streams[w];
            return (
              <div key={w} className="rounded-xl bg-surface-base border border-surface-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {WORKSTREAM_LABEL[w]}
                    {!s.required && <span className="ml-1.5 normal-case font-medium">(optional)</span>}
                  </p>
                  {s.complete && <CheckCircle2 size={14} className="text-emerald-500" />}
                </div>
                <div className="mt-2">
                  <Meter done={s.done} total={s.total} color={WORKSTREAM_COLOR[w]} />
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1.5 tabular-nums">
                  {s.done}/{s.total} done · {s.inProgress} active · {s.inReview} in review
                  {s.blocked ? ` · ${s.blocked} blocked` : ""}
                </p>
              </div>
            );
          })}
        </div>

        <div
          className={`rounded-xl border px-4 py-3 text-[12.5px] flex flex-wrap items-center justify-between gap-3 ${
            life.gatePassed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-surface-border bg-surface-base text-muted-foreground"
          }`}
        >
          <div className="flex items-start gap-2">
            {life.gatePassed ? <CheckCircle2 size={15} className="mt-0.5" /> : <CircleAlert size={15} className="mt-0.5" />}
            <div>
              <p className="font-semibold text-foreground">
                {life.gatePassed
                  ? page.requireFinalApproval && !page.releasedAt
                    ? "All gates passed — waiting for final release approval"
                    : "Completion gate passed"
                  : "Not complete yet"}
              </p>
              {!life.gatePassed && <p className="mt-0.5">{life.gateProblems.join(" · ")}</p>}
              <p className="text-[11px] mt-1 opacity-80">
                Percentages are progress indicators only — completion needs every required item approved, no blockers and no release-blocking bugs.
              </p>
            </div>
          </div>
          {lead && life.gatePassed && page.requireFinalApproval && !page.releasedAt && !page.archivedAt && (
            <button className={btnPrimary} disabled={busy} onClick={doRelease}>
              Approve release
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-border overflow-x-auto">
        {(
          [
            { id: "board", label: "Workstreams", icon: LayoutGrid },
            { id: "bugs", label: `Bugs${openBugs.length ? ` (${openBugs.length})` : ""}`, icon: Bug },
            { id: "activity", label: "Activity", icon: History },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 h-10 text-[13px] font-medium border-b-[1.5px] -mb-px whitespace-nowrap transition-colors ${
                tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
        {tab === "board" && (
          <div className="ml-auto flex items-center gap-3 pr-1 text-[12px] text-muted-foreground">
            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
              Mine only
            </label>
            {lead && archivedCount > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Archived ({archivedCount})
              </label>
            )}
          </div>
        )}
      </div>

      {tab === "board" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {WORKSTREAMS.map((w) => (
            <section key={w} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: WORKSTREAM_COLOR[w] }} />
                  {WORKSTREAM_LABEL[w]}
                  <span className="text-muted-foreground font-medium">{byStream[w].length}</span>
                </h2>
                {canCreate(true) && (
                  <button
                    className="text-[12px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    onClick={() => setAdding(w)}
                  >
                    <Plus size={13} /> Add item
                  </button>
                )}
              </div>

              {byStream[w].length === 0 ? (
                <EmptyBlock>
                  No {WORKSTREAM_LABEL[w].toLowerCase()} work items yet.
                  {canCreate(true) ? " Add the first one." : ""}
                </EmptyBlock>
              ) : (
                byStream[w].map((item, idx) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    viewer={viewer}
                    lead={lead}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < byStream[w].length - 1}
                    onOpen={() => open(item.id)}
                    onChanged={refresh}
                    devBugs={page.bugs.filter((b) => (b.devWorkItemId === item.id || b.testWorkItemId === item.id) && !["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"].includes(b.status)).length}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}

      {tab === "bugs" && (
        <BugsPanel
          pageId={page.id}
          archived={!!page.archivedAt}
          bugs={page.bugs}
          devItems={devItems}
          viewer={viewer}
          members={members}
          onChanged={refresh}
          onOpenItem={(id) => {
            setTab("board");
            open(id);
          }}
        />
      )}

      {tab === "activity" && (
        <div className={`${cardCls} p-5`}>
          {activity.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-[12.5px]">
                  <UserDot user={a.actor} />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground">
                      <b className="text-foreground">{a.actor.displayName}</b>{" "}
                      {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                      {a.workItem && (
                        <>
                          {" "}
                          <button className="text-primary hover:underline" onClick={() => open(a.workItem!.id)}>
                            {a.workItem.title}
                          </button>
                        </>
                      )}
                      {a.isOverride && (
                        <span className="ml-2">
                          <Pill color="#D1495B">admin override</Pill>
                        </span>
                      )}
                    </p>
                    {a.reason && <p className="text-muted-foreground/90 mt-0.5">“{a.reason}”</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {adding && (
        <CreateWorkItemModal
          pageId={page.id}
          workstream={adding}
          viewer={viewer}
          members={members}
          boards={boards}
          onClose={() => setAdding(null)}
          onCreated={(id) => {
            setAdding(null);
            refresh();
            open(id);
          }}
        />
      )}

      {editing && <PageSettingsModal page={page} members={members} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}

      {selectedId && (
        <WorkItemDrawer
          key={selectedId}
          itemId={selectedId}
          viewer={viewer}
          members={members}
          devItems={devItems}
          onClose={() => open(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function WorkItemCard({
  item,
  viewer,
  lead,
  canMoveUp,
  canMoveDown,
  onOpen,
  onChanged,
  devBugs,
}: {
  item: PageItem;
  viewer: Viewer;
  lead: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onChanged: () => void;
  devBugs: number;
}) {
  const mine = item.assigneeId === viewer.id;
  const reviewing = item.reviewerId === viewer.id && item.status === "READY_FOR_REVIEW";
  const overdue = isOverdue(item.dueDate, item.status);
  const evidenceCount = Array.isArray(item.evidence) ? item.evidence.length : 0;

  const move = async (e: React.MouseEvent, direction: "up" | "down") => {
    e.stopPropagation();
    const r = await reorderWorkItem({ workItemId: item.id, direction });
    if (!r.success) return toast.error(r.error);
    onChanged();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={`${cardCls} p-3.5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group relative ${
        item.archivedAt ? "opacity-60" : ""
      } ${reviewing ? "ring-1 ring-purple-500/50" : ""}`}
      style={mine ? { borderLeft: "3px solid hsl(var(--primary))" } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-[13.5px] font-semibold leading-snug ${
            item.status === "DONE" || item.status === "CANCELLED" ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"
          }`}
        >
          {item.title}
        </p>
        {lead && (
          <div className="flex flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity -mt-1 -mr-1">
            <button disabled={!canMoveUp} onClick={(e) => move(e, "up")} className="text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move up">
              <ChevronUp size={14} />
            </button>
            <button disabled={!canMoveDown} onClick={(e) => move(e, "down")} className="text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move down">
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <StatusBadge status={item.status as never} />
        <PriorityBadge priority={item.priority as Priority} />
        {item.archivedAt && <Pill color="#6B7280">Archived</Pill>}
        {!item.ownerAcknowledged && <Pill color="#F59E0B">Needs acknowledgement</Pill>}
        {!item.isRequired && <Pill color="#9AA1AE" title={item.exclusionReason ?? undefined}>Optional</Pill>}
        {reviewing && <Pill color="#A855F7">Your review</Pill>}
      </div>

      {item.status === "BLOCKED" && item.blockedReason && (
        <p className="text-[11.5px] text-red-500 mt-2 line-clamp-2">Blocked: {item.blockedReason}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 text-[11.5px]">
        <div className="flex items-center gap-2 min-w-0">
          <UserChip user={item.assignee} />
          {!mine && <span title="Only the assignee can edit this item"><Lock size={11} className="text-muted-foreground/60" /></span>}
        </div>
        <span className={overdue ? "text-red-500 font-semibold" : "text-muted-foreground"}>
          {item.dueDate ? fmtDate(item.dueDate) : ""}
          {overdue ? " · overdue" : ""}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
        {item.reviewer ? (
          <span className="inline-flex items-center gap-1 min-w-0" title="Reviewer">
            Review: <span className="font-medium text-foreground/80 truncate">{item.reviewer.displayName}</span>
          </span>
        ) : item.requiresReview ? (
          <span className="text-amber-500">No reviewer</span>
        ) : (
          <span>No review needed</span>
        )}
        <span className="ml-auto flex items-center gap-2.5">
          {item._count.submissions > 0 && (
            <span className="inline-flex items-center gap-1" title="Submissions"><Paperclip size={11} />{item._count.submissions}</span>
          )}
          {evidenceCount > 0 && item._count.submissions === 0 && (
            <span className="inline-flex items-center gap-1" title="Draft evidence links"><Paperclip size={11} />{evidenceCount}</span>
          )}
          {item._count.comments > 0 && (
            <span className="inline-flex items-center gap-1"><MessageSquare size={11} />{item._count.comments}</span>
          )}
          {devBugs > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-500" title="Open linked bugs"><Bug size={11} />{devBugs}</span>
          )}
          {item.ticket && (
            <Link
              href={`/board/${item.ticket.boardId}?ticket=${item.ticket.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              title={`On board “${item.ticket.board.name}” (${item.ticket.column.name})`}
            >
              <Kanban size={11} />
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}

// ── Create work item ────────────────────────────────────────────────────────

function CreateWorkItemModal({
  pageId,
  workstream,
  viewer,
  members,
  boards,
  onClose,
  onCreated,
}: {
  pageId: string;
  workstream: Workstream;
  viewer: Viewer;
  members: Member[];
  boards: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const lead = isLeadRole(viewer);
  const assignable = members.filter((m) => m.role !== "ADMIN");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: "",
    description: "",
    acceptanceCriteria: "",
    priority: "MEDIUM" as Priority,
    assigneeId: lead ? "" : viewer.id,
    reviewerId: "",
    requiresReview: true,
    dueDate: "",
    boardId: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.assigneeId) return toast.error("Choose who owns this item");
    if (f.requiresReview && !f.reviewerId) return toast.error("Choose a reviewer (or turn review off)");
    setBusy(true);
    const r = await createWorkItem({
      pageId,
      workstream,
      title: f.title,
      description: f.description || null,
      acceptanceCriteria: f.acceptanceCriteria || null,
      priority: f.priority,
      assigneeId: f.assigneeId,
      reviewerId: f.requiresReview ? f.reviewerId || null : f.reviewerId || null,
      requiresReview: f.requiresReview,
      dueDate: isoFromDateInput(f.dueDate),
      boardId: f.boardId || null,
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Work item created");
    onCreated(r.data.id);
  };

  return (
    <Modal title={`New ${WORKSTREAM_LABEL[workstream].toLowerCase()} work item`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} required autoFocus maxLength={200} value={f.title} onChange={(e) => set("title", e.target.value)}
            placeholder={workstream === "DESIGN" ? "e.g. Mobile responsive design" : workstream === "DEVELOPMENT" ? "e.g. Listing API integration" : "e.g. Verify filters and sorting"} />
        </div>
        <div>
          <label className={labelCls}>Description / expected outcome</label>
          <textarea className={`${inputCls} min-h-[70px]`} maxLength={5000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Acceptance criteria</label>
          <textarea className={`${inputCls} min-h-[56px]`} maxLength={3000} value={f.acceptanceCriteria} onChange={(e) => set("acceptanceCriteria", e.target.value)} placeholder="How will the reviewer know it is done?" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Owner (assignee)</label>
            <UserSelect users={assignable} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} emptyLabel="Select…" disabled={!lead} />
            {!lead && <p className="text-[11px] text-muted-foreground mt-1">Members can only create items for themselves.</p>}
          </div>
          <div>
            <label className={labelCls}>Reviewer</label>
            <UserSelect users={members} value={f.reviewerId} onChange={(v) => set("reviewerId", v)} exclude={[f.assigneeId]} emptyLabel="Select…" />
          </div>
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
        <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.requiresReview} onChange={(e) => set("requiresReview", e.target.checked)} />
          <span>
            <span className="font-medium text-foreground">Requires review</span>
            <span className="block text-[11.5px] text-muted-foreground">The reviewer must approve the submitted evidence before the item is Done.</span>
          </span>
        </label>
        {boards.length > 0 && (
          <div>
            <label className={labelCls}>Also show on Kanban board</label>
            <select className={inputCls} value={f.boardId} onChange={(e) => set("boardId", e.target.value)}>
              <option value="">Don’t show on a board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">The card stays in sync; only the owner can move it, and only to To Do / In Progress.</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !f.title.trim()}>{busy ? "Creating…" : "Create work item"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page settings ───────────────────────────────────────────────────────────

function PageSettingsModal({
  page,
  members,
  onClose,
  onSaved,
}: {
  page: Detail["page"];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialLinks = (Array.isArray(page.links) ? page.links : []) as { label: string; url: string }[];
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: page.name,
    description: page.description ?? "",
    type: page.type as "PAGE" | "MODULE",
    priority: page.priority as Priority,
    ownerId: page.ownerId ?? "",
    targetDate: dateInputValue(page.targetDate),
    designRequired: page.designRequired,
    developmentRequired: page.developmentRequired,
    testingRequired: page.testingRequired,
    requireFinalApproval: page.requireFinalApproval,
    membersCanCreate: page.membersCanCreate,
  });
  const [links, setLinks] = useState(initialLinks.length ? initialLinks : [{ label: "", url: "" }]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await updatePage({
      pageId: page.id,
      changes: {
        name: f.name,
        description: f.description || null,
        type: f.type,
        priority: f.priority,
        ownerId: f.ownerId || null,
        targetDate: isoFromDateInput(f.targetDate),
        links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() })),
        designRequired: f.designRequired,
        developmentRequired: f.developmentRequired,
        testingRequired: f.testingRequired,
        requireFinalApproval: f.requireFinalApproval,
        membersCanCreate: f.membersCanCreate,
      },
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Page updated");
    onSaved();
  };

  const Check = ({ k, label }: { k: keyof typeof f; label: string }) => (
    <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
      <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
      {label}
    </label>
  );

  return (
    <Modal title="Page settings" onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} required maxLength={100} value={f.name} onChange={(e) => set("name", e.target.value)} />
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
          <textarea className={`${inputCls} min-h-[70px]`} maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Priority</label>
            <select className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => (
                <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Owner</label>
            <UserSelect users={members} value={f.ownerId} onChange={(v) => set("ownerId", v)} emptyLabel="None" />
          </div>
          <div>
            <label className={labelCls}>Target date</label>
            <input type="date" className={inputCls} value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Links (requirements, Figma, environments…)</label>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <input className={inputCls} placeholder="Label" value={l.label} maxLength={80} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={inputCls} placeholder="https://…" value={l.url} onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <button type="button" className={btnGhost} onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} aria-label="Remove link">✕</button>
              </div>
            ))}
            <button type="button" className="text-[12px] text-primary font-semibold" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])}>+ Add link</button>
          </div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-base p-3.5 space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground">Completion rules</p>
          <Check k="designRequired" label="Design is required" />
          <Check k="developmentRequired" label="Development is required" />
          <Check k="testingRequired" label="Testing is required" />
          <Check k="requireFinalApproval" label="Require final release approval" />
          <Check k="membersCanCreate" label="Team members can add work items (assigned to themselves)" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
    </Modal>
  );
}

