"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ClipboardCheck, MessageSquareWarning, History } from "lucide-react";
import type { getReviewQueue } from "@/lib/page-tracker/queries";
import { REVIEW_SLA_DAYS } from "@/lib/page-tracker/review-sla";
import type { Workstream } from "@/lib/page-tracker/constants";
import { EmptyBlock, Pill, UserChip, WorkstreamBadge, cardCls } from "./ui";

type Data = Awaited<ReturnType<typeof getReviewQueue>>;

export function ReviewsClient({ data }: { data: Data }) {
  const overdue = data.awaiting.filter((i) => i.overdue);
  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground tracking-tight">Reviews</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Submissions where you are the reviewer. Approve, or send back with a clear reason.
        </p>
      </div>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
          <ClipboardCheck size={15} className="text-purple-500" />
          <h2 className="text-[13px] font-semibold">Awaiting my review</h2>
          <span className="text-[12px] text-muted-foreground">{data.awaiting.length}</span>
          {overdue.length > 0 && <Pill color="#D1495B">{overdue.length} overdue (over {REVIEW_SLA_DAYS} days)</Pill>}
        </div>
        {data.awaiting.length === 0 ? (
          <p className="px-4 py-5 text-[12.5px] text-muted-foreground">Nothing is waiting for you.</p>
        ) : (
          <div className="divide-y divide-surface-border">
            {data.awaiting.map((i) => {
              const sub = i.submissions[0];
              return (
                <Link
                  key={i.id}
                  href={`/page-tracker/${i.page.id}?item=${i.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-surface-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold truncate">{i.title}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {i.page.name} · submission #{sub?.submissionNumber ?? 1} ·{" "}
                      {formatDistanceToNow(new Date(sub?.submittedAt ?? i.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <WorkstreamBadge ws={i.workstream as Workstream} />
                  <UserChip user={i.assignee} />
                  {i.overdue && <Pill color="#D1495B">Overdue</Pill>}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {data.changes.length > 0 && (
        <section className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
            <MessageSquareWarning size={15} className="text-amber-500" />
            <h2 className="text-[13px] font-semibold">Changes requested by me</h2>
            <span className="text-[12px] text-muted-foreground">{data.changes.length}</span>
          </div>
          <div className="divide-y divide-surface-border">
            {data.changes.map((i) => (
              <Link key={i.id} href={`/page-tracker/${i.page.id}?item=${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold truncate">{i.title}</p>
                  <p className="text-[11.5px] text-muted-foreground truncate">{i.page.name}</p>
                </div>
                <UserChip user={i.assignee} />
                <Pill color="#F59E0B">Waiting on owner</Pill>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={`${cardCls} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
          <History size={15} className="text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">Review history</h2>
        </div>
        {data.history.length === 0 ? (
          <div className="p-4">
            <EmptyBlock>You have not reviewed anything yet.</EmptyBlock>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {data.history.map((r) => (
              <Link
                key={r.id}
                href={`/page-tracker/${r.workItem.pageId}?item=${r.workItem.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-hover"
              >
                {r.decision === "APPROVED" ? (
                  <CheckCircle2 size={15} className="text-emerald-500" />
                ) : (
                  <MessageSquareWarning size={15} className="text-amber-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{r.workItem.title}</p>
                  <p className="text-[11.5px] text-muted-foreground truncate">
                    {r.workItem.page.name} · #{r.submission.submissionNumber}
                    {r.comment ? ` · “${r.comment}”` : ""}
                  </p>
                </div>
                <span className="text-[11.5px] text-muted-foreground">
                  {formatDistanceToNow(new Date(r.reviewedAt), { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
