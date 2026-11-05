"use client";

import Link from "next/link";
import { AlertTriangle, Bug, CalendarClock, FlaskConical, RotateCcw, ShieldCheck } from "lucide-react";
import type { getMyWork } from "@/lib/page-tracker/queries";
import { BUG_STATUS_LABEL, SEVERITY_COLOR, type BugSeverity, type BugStatus, type Workstream } from "@/lib/page-tracker/constants";
import { EmptyBlock, Pill, PriorityBadge, StatusBadge, WorkstreamBadge, cardCls, fmtDate, isOverdue } from "./ui";

type Data = Awaited<ReturnType<typeof getMyWork>>;
type Assigned = Data["assigned"][number];

const DAY = 86_400_000;

function ItemRow({ item }: { item: Assigned }) {
  const overdue = isOverdue(item.dueDate, item.status as never);
  return (
    <Link
      href={`/page-tracker/${item.page.id}?item=${item.id}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-surface-hover transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground truncate">{item.title}</p>
        <p className="text-[11.5px] text-muted-foreground truncate">{item.page.name}</p>
      </div>
      <WorkstreamBadge ws={item.workstream as Workstream} />
      <StatusBadge status={item.status as never} />
      <PriorityBadge priority={item.priority as never} />
      <span className={`text-[12px] w-24 text-right ${overdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
        {item.dueDate ? fmtDate(item.dueDate) : "No date"}
      </span>
    </Link>
  );
}

function Group({ title, icon: Icon, color, items }: { title: string; icon: React.ElementType; color: string; items: Assigned[] }) {
  if (items.length === 0) return null;
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="text-[12px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="divide-y divide-surface-border">
        {items.map((i) => (
          <ItemRow key={i.id} item={i} />
        ))}
      </div>
    </section>
  );
}

export function MyWorkClient({ data }: { data: Data }) {
  const now = Date.now();
  const { assigned } = data;
  const needsAck = assigned.filter((i) => !i.ownerAcknowledged);
  const returned = assigned.filter((i) => i.status === "CHANGES_REQUESTED");
  const overdue = assigned.filter((i) => isOverdue(i.dueDate, i.status as never));
  const dueSoon = assigned.filter(
    (i) => i.dueDate && !isOverdue(i.dueDate, i.status as never) && new Date(i.dueDate).getTime() - now <= 3 * DAY
  );
  const shown = new Set([...needsAck, ...returned, ...overdue, ...dueSoon].map((i) => i.id));
  const rest = assigned.filter((i) => !shown.has(i.id) && i.workstream !== "TESTING");
  const testing = assigned.filter((i) => i.workstream === "TESTING" && !shown.has(i.id));
  const awaitingReview = data.reviewing.filter((i) => i.status === "READY_FOR_REVIEW");

  const nothing = assigned.length === 0 && data.bugs.length === 0 && awaitingReview.length === 0 && data.retests.length === 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground tracking-tight">My Work</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Everything you own or need to act on across all pages — {assigned.length} open, {data.doneCount} done.
        </p>
      </div>

      {nothing && <EmptyBlock>You have nothing assigned right now.</EmptyBlock>}

      {awaitingReview.length > 0 && (
        <Link
          href="/page-tracker/reviews"
          className="block rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-[13px] text-foreground hover:bg-purple-500/15"
        >
          <b>{awaitingReview.length}</b> submission{awaitingReview.length > 1 ? "s are" : " is"} waiting for your review →
        </Link>
      )}

      <Group title="Needs your acknowledgement" icon={ShieldCheck} color="#F59E0B" items={needsAck} />
      <Group title="Returned for changes" icon={RotateCcw} color="#F59E0B" items={returned} />
      <Group title="Overdue" icon={AlertTriangle} color="#D1495B" items={overdue} />
      <Group title="Due soon (3 days)" icon={CalendarClock} color="#3B82F6" items={dueSoon} />
      <Group title="Design & development" icon={CalendarClock} color="#5B5FEF" items={rest} />
      <Group title="My testing tasks" icon={FlaskConical} color="#1EAE7C" items={testing} />

      {data.retests.length > 0 && (
        <section className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <Bug size={15} className="text-purple-500" />
            <h2 className="text-[13px] font-semibold">Fixes waiting for your retest</h2>
            <span className="text-[12px] text-muted-foreground">{data.retests.length}</span>
          </div>
          <div className="divide-y divide-surface-border">
            {data.retests.map((b) => (
              <Link key={b.id} href={`/page-tracker/${b.page.id}?tab=bugs`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                <p className="flex-1 text-[13.5px] font-semibold truncate">{b.title}</p>
                <span className="text-[11.5px] text-muted-foreground">{b.page.name}</span>
                <Pill color="#A855F7">Ready for retest</Pill>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.bugs.length > 0 && (
        <section className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <Bug size={15} className="text-orange-500" />
            <h2 className="text-[13px] font-semibold">Bugs assigned to me</h2>
            <span className="text-[12px] text-muted-foreground">{data.bugs.length}</span>
          </div>
          <div className="divide-y divide-surface-border">
            {data.bugs.map((b) => (
              <Link key={b.id} href={`/page-tracker/${b.page.id}?tab=bugs`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                <p className="flex-1 text-[13.5px] font-semibold truncate">{b.title}</p>
                <span className="text-[11.5px] text-muted-foreground">{b.page.name}</span>
                <Pill color={SEVERITY_COLOR[b.severity as BugSeverity]}>{b.severity[0] + b.severity.slice(1).toLowerCase()}</Pill>
                <Pill color="#3B82F6">{BUG_STATUS_LABEL[b.status as BugStatus]}</Pill>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
