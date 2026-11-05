"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ClipboardCheck, MessageSquareWarning } from "lucide-react";
import type { getReviewQueue } from "@/lib/page-tracker/queries";
import { REVIEW_SLA_DAYS } from "@/lib/page-tracker/review-sla";
import type { Workstream } from "@/lib/page-tracker/constants";
import { EmptyState } from "@/components/ui";
import { UserDot, WorkstreamBadge } from "./ui";

type Data = Awaited<ReturnType<typeof getReviewQueue>>;

function Heading({ title, count, extra }: { title: string; count?: number; extra?: React.ReactNode }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-2 mb-2">
      <span className="text-[14px] font-semibold text-foreground">{title}</span>
      {count !== undefined && <span className="text-[12.5px] text-muted-foreground tabular-nums">{count}</span>}
      {extra}
    </h2>
  );
}

const listCls = "rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden bg-surface-elevated";
const rowCls = "flex items-center gap-3 px-4 min-h-[52px] py-2.5 hover:bg-surface-hover/60 transition-colors";

export function ReviewsClient({ data }: { data: Data }) {
  const overdue = data.awaiting.filter((i) => i.overdue);
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-8 max-w-[1100px]">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground tracking-[-0.02em]">Reviews</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Submissions where you're the reviewer. Approve, or send back with a clear reason.</p>
        </div>

        <section>
          <Heading
            title="Waiting for you"
            count={data.awaiting.length}
            extra={overdue.length > 0 && <span className="text-[12.5px] text-red-600 dark:text-red-400">· {overdue.length} waiting over {REVIEW_SLA_DAYS} days</span>}
          />
          {data.awaiting.length === 0 ? (
            <EmptyState icon={<ClipboardCheck />} title="Nothing to review" description="When someone submits work with you as reviewer, it shows up here." className="py-10" />
          ) : (
            <ul className={listCls}>
              {data.awaiting.map((i) => {
                const sub = i.submissions[0];
                return (
                  <li key={i.id}>
                    <Link href={`/page-tracker/${i.page.id}?item=${i.id}`} className={rowCls}>
                      <UserDot user={i.assignee} size={24} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-foreground truncate">{i.title}</p>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {i.assignee.displayName} · {i.page.name} · #{sub?.submissionNumber ?? 1} · {formatDistanceToNow(new Date(sub?.submittedAt ?? i.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <span className="hidden md:block w-[110px]">
                        <WorkstreamBadge ws={i.workstream as Workstream} />
                      </span>
                      {i.overdue ? (
                        <span className="text-[12.5px] font-medium text-red-600 dark:text-red-400 whitespace-nowrap">Overdue</span>
                      ) : (
                        <span className="text-[12.5px] font-medium text-primary whitespace-nowrap">Review</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {data.changes.length > 0 && (
          <section>
            <Heading title="Sent back by you" count={data.changes.length} extra={<span className="text-[12.5px] text-muted-foreground">· waiting on the owner</span>} />
            <ul className={listCls}>
              {data.changes.map((i) => (
                <li key={i.id}>
                  <Link href={`/page-tracker/${i.page.id}?item=${i.id}`} className={rowCls}>
                    <UserDot user={i.assignee} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-foreground truncate">{i.title}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {i.assignee.displayName} · {i.page.name}
                      </p>
                    </div>
                    <span className="text-[12.5px] text-amber-600 dark:text-amber-400 whitespace-nowrap">Changes requested</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <Heading title="History" />
          {data.history.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">You haven't reviewed anything yet.</p>
          ) : (
            <ul className={listCls}>
              {data.history.map((r) => (
                <li key={r.id}>
                  <Link href={`/page-tracker/${r.workItem.pageId}?item=${r.workItem.id}`} className={rowCls}>
                    {r.decision === "APPROVED" ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> : <MessageSquareWarning size={16} className="text-amber-500 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-foreground truncate">{r.workItem.title}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {r.workItem.page.name} · #{r.submission.submissionNumber}
                        {r.comment ? ` · “${r.comment}”` : ""}
                      </p>
                    </div>
                    <span className="text-[12px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(r.reviewedAt), { addSuffix: true })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
