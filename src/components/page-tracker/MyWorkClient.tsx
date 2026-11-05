"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { getMyWork } from "@/lib/page-tracker/queries";
import { BUG_STATUS_LABEL, SEVERITY_COLOR, type BugSeverity, type BugStatus, type Workstream } from "@/lib/page-tracker/constants";
import { EmptyState } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";
import { WorkItemStatusIcon, WorkstreamBadge, isOverdue } from "./ui";

type Data = Awaited<ReturnType<typeof getMyWork>>;
type Assigned = Data["assigned"][number];

const DAY = 86_400_000;

function due(d: Date | string | null, status: string) {
  if (!d) return <span className="text-muted-foreground/50">—</span>;
  const overdue = isOverdue(d, status as never);
  return (
    <span className={`tabular-nums ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
      {new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
    </span>
  );
}

function ItemRow({ item }: { item: Assigned }) {
  return (
    <li>
      <Link href={`/page-tracker/${item.page.id}?item=${item.id}`} className="flex items-center gap-3 px-4 min-h-[48px] py-2 hover:bg-surface-hover/60 transition-colors">
        <WorkItemStatusIcon status={item.status as never} size={15} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-foreground truncate">{item.title}</p>
          <p className="text-[12px] text-muted-foreground truncate sm:hidden">{item.page.name}</p>
        </div>
        <span className="hidden sm:block text-[12.5px] text-muted-foreground truncate max-w-[180px]">{item.page.name}</span>
        <span className="hidden md:block w-[110px]">
          <WorkstreamBadge ws={item.workstream as Workstream} />
        </span>
        <span className="w-[64px] text-right text-[12.5px]">{due(item.dueDate, item.status)}</span>
      </Link>
    </li>
  );
}

function Group({ title, hint, items, tone }: { title: string; hint?: string; items: Assigned[]; tone?: "warning" | "danger" }) {
  if (items.length === 0) return null;
  const dot = tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-muted-foreground/50";
  return (
    <section>
      <h2 className="flex items-baseline gap-2 mb-2">
        <span className={`self-center w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-[14px] font-semibold text-foreground">{title}</span>
        <span className="text-[12.5px] text-muted-foreground tabular-nums">{items.length}</span>
        {hint && <span className="hidden sm:inline text-[12.5px] text-muted-foreground">· {hint}</span>}
      </h2>
      <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
        {items.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </ul>
    </section>
  );
}

export function MyWorkClient({ data }: { data: Data }) {
  const now = Date.now();
  const { assigned } = data;
  // Each item appears once, in its most urgent group (ack → returned → overdue → due soon).
  const shown = new Set<string>();
  const take = (pred: (i: Assigned) => boolean) => {
    const out = assigned.filter((i) => !shown.has(i.id) && pred(i));
    out.forEach((i) => shown.add(i.id));
    return out;
  };
  const needsAck = take((i) => !i.ownerAcknowledged);
  const returned = take((i) => i.status === "CHANGES_REQUESTED");
  const overdue = take((i) => isOverdue(i.dueDate, i.status as never));
  const dueSoon = take((i) => !!i.dueDate && new Date(i.dueDate).getTime() - now <= 3 * DAY);
  const rest = assigned.filter((i) => !shown.has(i.id) && i.workstream !== "TESTING");
  const testing = assigned.filter((i) => i.workstream === "TESTING" && !shown.has(i.id));
  const awaitingReview = data.reviewing.filter((i) => i.status === "READY_FOR_REVIEW");
  const actionCount = needsAck.length + returned.length + overdue.length + awaitingReview.length + data.retests.length;

  const nothing = assigned.length === 0 && data.bugs.length === 0 && awaitingReview.length === 0 && data.retests.length === 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-8 max-w-[1100px]">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground tracking-[-0.02em]">My work</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {assigned.length} open · {data.doneCount} done
            {actionCount > 0 && (
              <>
                {" · "}
                <span className="text-foreground">
                  {actionCount} need{actionCount === 1 ? "s" : ""} your action
                </span>
              </>
            )}
          </p>
        </div>

        {nothing && <EmptyState icon={<CheckCircle2 />} title="You're all clear" description="Nothing is assigned to you, and nothing is waiting for your review." />}

        {awaitingReview.length > 0 && (
          <Link
            href="/page-tracker/reviews"
            className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-[13.5px] text-foreground hover:bg-primary/[0.07] transition-colors"
          >
            <span>
              <span className="font-semibold">{awaitingReview.length}</span> submission{awaitingReview.length > 1 ? "s are" : " is"} waiting for your review
            </span>
            <ArrowRight size={15} className="text-primary shrink-0" />
          </Link>
        )}

        <Group title="Acknowledge ownership" hint="reassigned to you" tone="warning" items={needsAck} />
        <Group title="Returned for changes" hint="your reviewer sent these back" tone="warning" items={returned} />
        <Group title="Overdue" tone="danger" items={overdue} />
        <Group title="Due in the next 3 days" items={dueSoon} />
        <Group title="Design & development" items={rest} />
        <Group title="Testing" items={testing} />

        {data.retests.length > 0 && (
          <section>
            <h2 className="flex items-baseline gap-2 mb-2">
              <span className="self-center w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[14px] font-semibold text-foreground">Fixes waiting for your retest</span>
              <span className="text-[12.5px] text-muted-foreground tabular-nums">{data.retests.length}</span>
            </h2>
            <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
              {data.retests.map((b) => (
                <li key={b.id}>
                  <Link href={`/page-tracker/${b.page.id}?tab=bugs`} className="flex items-center gap-3 px-4 min-h-[48px] py-2 hover:bg-surface-hover/60">
                    <span className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{b.title}</span>
                    <span className="hidden sm:block text-[12.5px] text-muted-foreground truncate max-w-[180px]">{b.page.name}</span>
                    <span className="text-[12.5px] text-primary whitespace-nowrap">Ready for retest</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.bugs.length > 0 && (
          <section>
            <h2 className="flex items-baseline gap-2 mb-2">
              <span className="self-center w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-[14px] font-semibold text-foreground">Bugs assigned to me</span>
              <span className="text-[12.5px] text-muted-foreground tabular-nums">{data.bugs.length}</span>
            </h2>
            <ul className="rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated">
              {data.bugs.map((b) => (
                <li key={b.id}>
                  <Link href={`/page-tracker/${b.page.id}?tab=bugs`} className="flex items-center gap-3 px-4 min-h-[48px] py-2 hover:bg-surface-hover/60">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEVERITY_COLOR[b.severity as BugSeverity] }} title={`${b.severity.toLowerCase()} severity`} />
                    <span className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{b.title}</span>
                    <span className="hidden sm:block text-[12.5px] text-muted-foreground truncate max-w-[180px]">{b.page.name}</span>
                    <span className="text-[12.5px] text-muted-foreground whitespace-nowrap">{BUG_STATUS_LABEL[b.status as BugStatus]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
