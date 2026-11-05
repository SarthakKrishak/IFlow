"use client";

import type { getWorkload } from "@/lib/page-tracker/queries";
import { UserChip, cardCls } from "./ui";

type Rows = Awaited<ReturnType<typeof getWorkload>>;

const COLS: { key: "open" | "inProgress" | "blocked" | "inReview" | "changes" | "overdue"; label: string; warn?: boolean }[] = [
  { key: "open", label: "Open" },
  { key: "inProgress", label: "In progress" },
  { key: "blocked", label: "Blocked", warn: true },
  { key: "inReview", label: "In review" },
  { key: "changes", label: "Changes requested" },
  { key: "overdue", label: "Overdue", warn: true },
];

export function WorkloadClient({ rows }: { rows: Rows }) {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground tracking-tight">Team workload</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Where open work sits right now. Item counts show distribution, not productivity — items differ a lot in size and complexity.
        </p>
      </div>
      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-[13px] min-w-[640px]">
          <thead>
            <tr className="text-left text-[12px] font-medium text-muted-foreground border-b border-surface-border">
              <th className="px-4 py-3">Member</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {rows.map((r) => (
              <tr key={r.user.id}>
                <td className="px-4 py-3">
                  <UserChip user={r.user} />
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-3 text-center tabular-nums ${
                      r[c.key] && c.warn ? "text-red-500 font-semibold" : r[c.key] ? "text-foreground font-semibold" : "text-muted-foreground/50"
                    }`}
                  >
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No team members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
