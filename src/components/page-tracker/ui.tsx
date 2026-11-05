"use client";

import { Dialog, buttonStyles, controlCls } from "@/components/ui";
import {
  PRIORITY_COLOR,
  STATUS_COLOR,
  STATUS_LABEL,
  WORKSTREAM_COLOR,
  WORKSTREAM_LABEL,
  type Priority,
  type Workstream,
  type WorkItemStatus,
} from "@/lib/page-tracker/constants";

export interface Person {
  id: string;
  displayName: string;
  avatarColor: string;
}
export interface Member extends Person {
  role: string;
}
export interface Viewer {
  id: string;
  role: "ADMIN" | "MANAGER" | "MEMBER";
}

export const isLeadRole = (v: Viewer) => v.role === "ADMIN" || v.role === "MANAGER";

export const inputCls = controlCls;
export const labelCls = "block text-[12.5px] font-medium text-foreground mb-1.5";
export const btnPrimary = buttonStyles("primary", "md");
export const btnGhost = buttonStyles("secondary", "md");
export const btnDanger = buttonStyles("danger", "md");
export const cardCls = "surface-card";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog title={title} onClose={onClose} size={wide ? "lg" : "md"}>
      {children}
    </Dialog>
  );
}

export function Pill({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded-md border border-surface-border bg-surface-elevated text-[11.5px] text-foreground/85 whitespace-nowrap"
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: WorkItemStatus }) {
  return <Pill color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Pill>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Pill color={PRIORITY_COLOR[priority]}>{priority[0] + priority.slice(1).toLowerCase()}</Pill>;
}
export function WorkstreamBadge({ ws }: { ws: Workstream }) {
  return <Pill color={WORKSTREAM_COLOR[ws]}>{WORKSTREAM_LABEL[ws]}</Pill>;
}

export function UserDot({ user, size = 22 }: { user: Person; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.45 }}
      title={user.displayName}
    >
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

export function UserChip({ user, empty = "Unassigned" }: { user: Person | null | undefined; empty?: string }) {
  if (!user) return <span className="text-[12px] text-muted-foreground italic">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <UserDot user={user} />
      <span className="text-[12.5px] font-medium text-foreground truncate">{user.displayName}</span>
    </span>
  );
}

export function UserSelect({
  users,
  value,
  onChange,
  exclude = [],
  emptyLabel,
  disabled,
}: {
  users: Person[];
  value: string;
  onChange: (id: string) => void;
  exclude?: (string | null | undefined)[];
  emptyLabel?: string;
  disabled?: boolean;
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {users
        .filter((u) => !exclude.includes(u.id) || u.id === value)
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
    </select>
  );
}

// ── Dates ───────────────────────────────────────────────────────────────────

export function dateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

/** yyyy-mm-dd (from <input type=date>) → ISO at local noon, so the day never shifts across timezones. */
export function isoFromDateInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "—" : x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime())
    ? "—"
    : x.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const OPEN: WorkItemStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "READY_FOR_REVIEW", "CHANGES_REQUESTED"];
export function isOverdue(due: Date | string | null | undefined, status: WorkItemStatus): boolean {
  if (!due || !OPEN.includes(status)) return false;
  const d = new Date(due);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return end.getTime() < Date.now();
}

export function SafeLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  // Only http(s) is ever rendered as a link (javascript:/data: are inert text).
  let ok = false;
  try {
    const u = new URL(href);
    ok = u.protocol === "http:" || u.protocol === "https:";
  } catch {
    ok = false;
  }
  if (!ok) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {children}
    </a>
  );
}

export function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-surface-border rounded-xl py-5 px-4 text-center text-[12.5px] text-muted-foreground">
      {children}
    </div>
  );
}

export function Meter({
  done,
  total,
  color,
}: {
  done: number;
  total: number;
  color: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-surface-base overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
