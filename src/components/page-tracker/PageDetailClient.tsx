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
  Rocket,
  ChevronRight,
} from "lucide-react";
import type { getPageDetail } from "@/lib/page-tracker/queries";
import {
  ACTION_LABEL,
  LIFECYCLE_COLOR,
  LIFECYCLE_LABEL,
  STATUS_LABEL,
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
  WorkItemStatusIcon,
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
import { Button, Segmented } from "@/components/ui";
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

  const [filter, setFilter] = useState<"all" | "mine" | "review">("all");
  const counts = {
    all: page.workItems.filter((i) => !i.archivedAt).length,
    mine: page.workItems.filter((i) => !i.archivedAt && i.assigneeId === viewer.id).length,
    review: page.workItems.filter((i) => !i.archivedAt && i.reviewerId === viewer.id && i.status === "READY_FOR_REVIEW").length,
  };
  const visibleByStream = useMemo(() => {
    const m: Record<Workstream, PageItem[]> = { DESIGN: [], DEVELOPMENT: [], TESTING: [] };
    for (const w of WORKSTREAMS)
      m[w] = byStream[w].filter((i) =>
        filter === "mine" ? i.assigneeId === viewer.id : filter === "review" ? i.reviewerId === viewer.id && i.status === "READY_FOR_REVIEW" : true
      );
    return m;
  }, [byStream, filter, viewer.id]);
  const bugCountFor = (id: string) =>
    page.bugs.filter((b) => (b.devWorkItemId === id || b.testWorkItemId === id) && !["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"].includes(b.status)).length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="px-4 sm:px-6 lg:px-10 pt-5 pb-16 max-w-[1240px]">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/page-tracker" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft size={13} /> Pages
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-foreground truncate">{page.name}</span>
        </nav>

        {/* Header */}
        <header className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground">
              <span>{page.type === "MODULE" ? "Module" : "Page"}</span>
              <span className="opacity-40">·</span>
              <PriorityBadge priority={page.priority as Priority} />
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1.5 text-foreground/85">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LIFECYCLE_COLOR[life.lifecycle] }} />
                {LIFECYCLE_LABEL[life.lifecycle]}
              </span>
              {page.archivedAt && <span className="text-amber-600 dark:text-amber-400">· Archived</span>}
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-foreground mt-1.5 leading-tight">{page.name}</h1>
            {page.description && <p className="text-[14px] text-muted-foreground mt-2 max-w-3xl leading-relaxed whitespace-pre-wrap line-clamp-3">{page.description}</p>}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                Owner <UserChip user={page.owner} empty="none" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} /> Target <span className="text-foreground">{page.targetDate ? fmtDate(page.targetDate) : "not set"}</span>
              </span>
              {links.map((l, i) => (
                <SafeLink key={i} href={l.url} className="inline-flex items-center gap-1 text-foreground/85 hover:text-foreground hover:underline underline-offset-2">
                  <ExternalLink size={12} className="text-muted-foreground" /> {l.label || safeHost(l.url)}
                </SafeLink>
              ))}
            </div>
          </div>
          {lead && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setEditing(true)}>
                <Settings2 size={14} /> Settings
              </Button>
              <Button variant="ghost" disabled={busy} onClick={doArchive} title={page.archivedAt ? "Restore page" : "Archive page"}>
                <Archive size={14} /> <span className="hidden sm:inline">{page.archivedAt ? "Restore" : "Archive"}</span>
              </Button>
            </div>
          )}
        </header>

        {/* Delivery pipeline: three separate streams, never one blended % */}
        <section className="mt-7" aria-label="Delivery pipeline">
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border">
            {WORKSTREAMS.map((w) => {
              const s = life.streams[w];
              const state = !s.required && s.total === 0
                ? { text: "Not required", tone: "text-muted-foreground" }
                : s.complete
                  ? { text: "Done", tone: "text-emerald-600 dark:text-emerald-400" }
                  : s.blocked
                    ? { text: `${s.blocked} blocked`, tone: "text-red-600 dark:text-red-400" }
                    : s.inReview
                      ? { text: `${s.inReview} in review`, tone: "text-primary" }
                      : s.inProgress || s.changes
                        ? { text: "In progress", tone: "text-amber-600 dark:text-amber-400" }
                        : { text: s.total ? "Not started" : "No items yet", tone: "text-muted-foreground" };
              return (
                <li key={w} className="bg-surface-elevated px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className="w-2 h-2 rounded-sm" style={{ background: WORKSTREAM_COLOR[w] }} />
                      {WORKSTREAM_LABEL[w]}
                    </span>
                    {s.complete && <CheckCircle2 size={15} className="text-emerald-500" />}
                  </div>
                  <p className={`text-[12.5px] mt-1.5 ${state.tone}`}>{state.text}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1">
                      <Meter done={s.done} total={s.total} color={WORKSTREAM_COLOR[w]} />
                    </div>
                    <span className="text-[11.5px] text-muted-foreground tabular-nums">
                      {s.done}/{s.total}
                    </span>
                  </div>
                </li>
              );
            })}
            <li className="bg-surface-elevated px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <Rocket size={13} className="text-muted-foreground" /> Release
                </span>
                {life.lifecycle === "COMPLETED" && <CheckCircle2 size={15} className="text-emerald-500" />}
              </div>
              <p className={`text-[12.5px] mt-1.5 ${life.gatePassed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {life.lifecycle === "COMPLETED"
                  ? "Completed"
                  : life.gatePassed
                    ? page.requireFinalApproval && !page.releasedAt
                      ? "Awaiting release approval"
                      : "Ready"
                    : `${life.gateProblems.length} thing${life.gateProblems.length === 1 ? "" : "s"} left`}
              </p>
              {lead && life.gatePassed && page.requireFinalApproval && !page.releasedAt && !page.archivedAt ? (
                <Button size="sm" variant="primary" className="mt-2" disabled={busy} onClick={doRelease}>
                  Approve release
                </Button>
              ) : (
                <p className="text-[11.5px] text-muted-foreground mt-2.5">{openBugs.length ? `${openBugs.length} open bug${openBugs.length > 1 ? "s" : ""}` : "No open bugs"}</p>
              )}
            </li>
          </ol>
          {!life.gatePassed && life.gateProblems.length > 0 && (
            <details className="mt-3 group">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground select-none">
                <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
                What's left before this is complete
              </summary>
              <ul className="mt-2 ml-5 space-y-1 text-[13px] text-foreground/85">
                {life.gateProblems.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-[7px] w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                    {p}
                  </li>
                ))}
                <li className="text-[12px] text-muted-foreground pt-1">Progress bars are informational — completion needs every required item approved.</li>
              </ul>
            </details>
          )}
        </section>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-surface-border">
          <div className="flex items-center gap-5 -mb-px" role="tablist">
            {(
              [
                { id: "board", label: "Work items", count: counts.all },
                { id: "bugs", label: "Bugs", count: openBugs.length },
                { id: "activity", label: "Activity", count: 0 },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`h-10 flex items-center gap-1.5 border-b-[1.5px] text-[13px] whitespace-nowrap transition-colors ${
                  tab === t.id ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.count > 0 && <span className="text-[11.5px] text-muted-foreground tabular-nums">{t.count}</span>}
              </button>
            ))}
          </div>
          {tab === "board" && (
            <div className="flex items-center gap-3 pb-2">
              {lead && archivedCount > 0 && (
                <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Archived ({archivedCount})
                </label>
              )}
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "mine", label: `Mine${counts.mine ? ` ${counts.mine}` : ""}` },
                  { value: "review", label: `To review${counts.review ? ` ${counts.review}` : ""}` },
                ]}
              />
            </div>
          )}
        </div>

        {tab === "board" && (
          <div className="mt-6 space-y-8">
            {WORKSTREAMS.map((w) => {
              const s = life.streams[w];
              const items = visibleByStream[w];
              return (
                <section key={w} aria-label={WORKSTREAM_LABEL[w]}>
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: WORKSTREAM_COLOR[w] }} />
                      {WORKSTREAM_LABEL[w]}
                      <span className="text-[12.5px] font-normal text-muted-foreground tabular-nums">
                        {s.done}/{s.total} done{!s.required && " · optional"}
                      </span>
                    </h2>
                    {canCreate(true) && (
                      <Button size="sm" variant="ghost" onClick={() => setAdding(w)}>
                        <Plus size={14} /> Add item
                      </Button>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-surface-border px-4 py-5 text-[13px] text-muted-foreground flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {filter === "all" ? `No ${WORKSTREAM_LABEL[w].toLowerCase()} items yet.` : filter === "mine" ? "None assigned to you here." : "Nothing waiting for your review here."}
                      </span>
                      {filter === "all" && canCreate(true) && (
                        <Button size="sm" onClick={() => setAdding(w)}>
                          <Plus size={13} /> Add the first
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
                      {items.map((item, idx) => (
                        <WorkItemRow
                          key={item.id}
                          item={item}
                          viewer={viewer}
                          lead={lead && filter === "all"}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < items.length - 1}
                          onOpen={() => open(item.id)}
                          onChanged={refresh}
                          bugs={bugCountFor(item.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {tab === "bugs" && (
          <div className="mt-6">
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
          </div>
        )}

        {tab === "activity" && (
          <div className="mt-6">
            {activity.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-[13px]">
                    <UserDot user={a.actor} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{a.actor.displayName}</span>{" "}
                        {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                        {a.workItem && (
                          <>
                            {" "}
                            <button type="button" className="text-foreground hover:underline underline-offset-2" onClick={() => open(a.workItem!.id)}>
                              {a.workItem.title}
                            </button>
                          </>
                        )}
                        {a.isOverride && <span className="ml-2 text-[11.5px] font-medium text-red-600 dark:text-red-400">admin override</span>}
                      </p>
                      {a.reason && <p className="text-muted-foreground/90 mt-0.5">“{a.reason}”</p>}
                    </div>
                    <span className="text-[12px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

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

      {editing && (
        <PageSettingsModal
          page={page}
          members={members}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}

      {selectedId && (
        <WorkItemDrawer key={selectedId} itemId={selectedId} viewer={viewer} members={members} devItems={devItems} onClose={() => open(null)} onChanged={refresh} />
      )}
    </div>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ── Row ─────────────────────────────────────────────────────────────────────

function WorkItemRow({
  item,
  viewer,
  lead,
  canMoveUp,
  canMoveDown,
  onOpen,
  onChanged,
  bugs,
}: {
  item: PageItem;
  viewer: Viewer;
  lead: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onChanged: () => void;
  bugs: number;
}) {
  const mine = item.assigneeId === viewer.id;
  const reviewing = item.reviewerId === viewer.id && item.status === "READY_FOR_REVIEW";
  const overdue = isOverdue(item.dueDate, item.status as never);
  const closed = item.status === "DONE" || item.status === "CANCELLED";

  const move = async (e: React.MouseEvent, direction: "up" | "down") => {
    e.stopPropagation();
    const r = await reorderWorkItem({ workItemId: item.id, direction });
    if (!r.success) return toast.error(r.error);
    onChanged();
  };

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={`group relative flex items-center gap-3 px-4 min-h-[52px] py-2.5 cursor-pointer hover:bg-surface-hover/60 transition-colors focus-visible:outline-none focus-visible:bg-surface-hover ${
        item.archivedAt ? "opacity-60" : ""
      }`}
    >
      <span title={STATUS_LABEL[item.status as never]}>
        <WorkItemStatusIcon status={item.status as never} size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[13.5px] truncate ${closed ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground font-medium"}`}>{item.title}</span>
          {reviewing && <Tag tone="review">Your review</Tag>}
          {mine && !item.ownerAcknowledged && <Tag tone="warning">Acknowledge</Tag>}
          {!item.isRequired && <Tag>Optional</Tag>}
          {item.archivedAt && <Tag>Archived</Tag>}
        </div>
        {item.status === "BLOCKED" && item.blockedReason ? (
          <p className="text-[12px] text-red-600 dark:text-red-400 truncate mt-0.5">Blocked: {item.blockedReason}</p>
        ) : (
          <p className="text-[12px] text-muted-foreground truncate mt-0.5 sm:hidden">
            {STATUS_LABEL[item.status as never]} · {item.assignee.displayName}
          </p>
        )}
      </div>

      {/* Signals */}
      <div className="hidden md:flex items-center gap-3 text-[12px] text-muted-foreground shrink-0">
        {bugs > 0 && (
          <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400" title="Open linked bugs">
            <Bug size={12} />
            {bugs}
          </span>
        )}
        {item._count.comments > 0 && (
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageSquare size={12} />
            {item._count.comments}
          </span>
        )}
        {item._count.submissions > 0 && (
          <span className="inline-flex items-center gap-1" title="Submissions">
            <Paperclip size={12} />
            {item._count.submissions}
          </span>
        )}
        {item.ticket && (
          <Link
            href={`/board/${item.ticket.boardId}?ticket=${item.ticket.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center hover:text-foreground"
            title={`On board “${item.ticket.board.name}” (${item.ticket.column.name})`}
          >
            <Kanban size={12} />
          </Link>
        )}
      </div>

      <span className="hidden lg:block w-[92px] shrink-0 text-[12px] text-muted-foreground truncate" title={item.reviewer ? `Reviewer: ${item.reviewer.displayName}` : undefined}>
        {item.reviewer ? `→ ${item.reviewer.displayName.split(" ")[0]}` : item.requiresReview ? <span className="text-amber-600 dark:text-amber-400">No reviewer</span> : ""}
      </span>

      <span className="hidden sm:flex items-center gap-2 w-[132px] shrink-0 min-w-0" title={`Owner: ${item.assignee.displayName}`}>
        <UserDot user={item.assignee} size={20} />
        <span className="text-[12.5px] text-foreground/85 truncate">{item.assignee.displayName}</span>
        {!mine && <Lock size={11} className="text-muted-foreground/50 shrink-0" />}
      </span>

      <span className={`w-[72px] shrink-0 text-right text-[12px] tabular-nums ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
        {item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
      </span>

      {lead && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex focus-within:flex flex-col bg-surface-elevated rounded-md border border-surface-border shadow-sm">
          <button type="button" disabled={!canMoveUp} onClick={(e) => move(e, "up")} className="h-5 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move up">
            <ChevronUp size={13} />
          </button>
          <button type="button" disabled={!canMoveDown} onClick={(e) => move(e, "down")} className="h-5 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-25" aria-label="Move down">
            <ChevronDown size={13} />
          </button>
        </div>
      )}
    </li>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "review" | "warning" }) {
  const cls =
    tone === "review"
      ? "border-primary/30 text-primary bg-primary/[0.06]"
      : tone === "warning"
        ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/[0.06]"
        : "border-surface-border text-muted-foreground";
  return <span className={`inline-flex items-center h-5 px-1.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${cls}`}>{children}</span>;
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

  const check = (k: keyof typeof f, label: string) => (
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
          {check("designRequired", "Design is required")}
          {check("developmentRequired", "Development is required")}
          {check("testingRequired", "Testing is required")}
          {check("requireFinalApproval", "Require final release approval")}
          {check("membersCanCreate", "Team members can add work items (assigned to themselves)")}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
    </Modal>
  );
}

