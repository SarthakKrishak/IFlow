/**
 * Status + priority glyphs — the small, consistent marks used on boards, lists and tables.
 * Shapes carry the meaning (fill level, bar count), colour only reinforces it.
 */
import type { Ticket } from "@prisma/client";

export type Stage = "backlog" | "todo" | "progress" | "review" | "done";

/** Map a free-form column name onto a workflow stage. */
export function stageOf(name: string): Stage {
  const n = name.toLowerCase();
  if (n.includes("backlog")) return "backlog";
  if (n.includes("progress") || n.includes("doing")) return "progress";
  if (n.includes("review") || n.includes("qa") || n.includes("test")) return "review";
  if (n.includes("done") || n.includes("complet")) return "done";
  return "todo";
}

/** Ring that fills as work moves right: dashed → empty → half → ¾ → checked. */
export function StageIcon({ stage, size = 14 }: { stage: Stage; size?: number }) {
  const color = {
    backlog: "text-muted-foreground/70",
    todo: "text-muted-foreground",
    progress: "text-amber-500",
    review: "text-primary",
    done: "text-emerald-500",
  }[stage];
  const fill = { backlog: 0, todo: 0, progress: 0.5, review: 0.75, done: 1 }[stage];
  const r = 3.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={`flex-shrink-0 ${color}`} aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={stage === "backlog" ? "1.6 1.9" : undefined} />
      {stage === "done" ? (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4.3 7.2 6.2 9l3.5-3.8" fill="none" stroke="hsl(var(--surface-elevated))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : fill > 0 ? (
        <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth={r * 2} strokeDasharray={`${c * fill} ${c}`} transform="rotate(-90 7 7)" />
      ) : null}
    </svg>
  );
}

export const PRIORITY_LABEL: Record<Ticket["priority"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Signal bars for Low/Medium/High; a filled red mark for Urgent so it stands out in a dense list. */
export function PriorityIcon({ priority, size = 14 }: { priority: Ticket["priority"]; size?: number }) {
  if (priority === "URGENT") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="text-red-500 flex-shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
        <path d="M7 3.8v4" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="7" cy="10.1" r="0.95" fill="white" />
      </svg>
    );
  }
  const level = { LOW: 1, MEDIUM: 2, HIGH: 3 }[priority];
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="text-foreground/80 flex-shrink-0" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={4 + i * 3} rx="0.8" fill="currentColor" opacity={i < level ? 1 : 0.22} />
      ))}
    </svg>
  );
}
