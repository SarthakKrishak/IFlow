import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Avatar, DepartmentTag, RelativeTime } from "@/components/shared";
import { ActivityHeatmap } from "@/components/people/ActivityHeatmap";
import type { Metadata } from "next";
import Link from "next/link";

interface PersonPageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  return { title: user ? `${user.displayName} — IFlow` : "Person — IFlow" };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { userId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      department: true,
      role: true,
      avatarColor: true,
      isActive: true,
    },
  });

  if (!user) notFound();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parallel data fetching
  const [
    completedThirtyDays,
    completedAllTime,
    currentOpenTickets,
    lastActivity,
    activityLogsForHeatmap,
    recentActivity,
    inProgressLogs,
  ] = await Promise.all([
    // Tickets completed in last 30 days (assigned to this user)
    prisma.ticket.count({
      where: {
        assigneeId: userId,
        completedAt: { gte: thirtyDaysAgo },
      },
    }),
    // All-time completed
    prisma.ticket.count({
      where: {
        assigneeId: userId,
        completedAt: { not: null },
      },
    }),
    // Current open tickets by priority
    prisma.ticket.groupBy({
      by: ["priority"],
      where: {
        assigneeId: userId,
        completedAt: null,
      },
      _count: { id: true },
    }),
    // Last activity
    prisma.activityLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    // All activity in last year for heatmap
    prisma.activityLog.findMany({
      where: {
        userId,
        createdAt: { gte: oneYearAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // Recent activity feed (first page)
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        ticket: { select: { id: true, title: true, boardId: true } },
        user: { select: { id: true, displayName: true } },
      },
    }),
    // For avg time in progress computation
    prisma.activityLog.findMany({
      where: {
        userId,
        action: "MOVED",
        toValue: "In Progress",
      },
      include: {
        ticket: { select: { id: true, completedAt: true } },
      },
    }),
  ]);

  // Compute avg time in progress
  let avgDaysInProgress: string | null = null;
  const completedWithProgress = inProgressLogs.filter((l) => l.ticket.completedAt);
  if (completedWithProgress.length > 0) {
    const totalMs = completedWithProgress.reduce((sum, l) => {
      const startMs = l.createdAt.getTime();
      const endMs = new Date(l.ticket.completedAt!).getTime();
      return sum + Math.max(0, endMs - startMs);
    }, 0);
    const avgMs = totalMs / completedWithProgress.length;
    const avgDays = avgMs / (1000 * 60 * 60 * 24);
    avgDaysInProgress = avgDays.toFixed(1) + " days";
  }

  // Open workload totals
  const openTotal = currentOpenTickets.reduce((s, g) => s + g._count.id, 0);
  const priorityMap = Object.fromEntries(currentOpenTickets.map((g) => [g.priority, g._count.id]));

  // Heatmap data: count per day
  const heatmapData = new Map<string, number>();
  for (const log of activityLogsForHeatmap) {
    const key = log.createdAt.toISOString().split("T")[0];
    heatmapData.set(key, (heatmapData.get(key) ?? 0) + 1);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{user.displayName}</h1>
          <div className="flex items-center gap-3 mt-1">
            <DepartmentTag department={user.department} />
            {user.role === "ADMIN" && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#5B5FEF]/15 text-[#5B5FEF] font-medium">Admin</span>
            )}
            {!user.isActive && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#D1495B]/15 text-[#D1495B] font-medium">Inactive</span>
            )}
            {lastActivity && (
              <span className="text-xs text-muted-foreground font-mono">
                Last active <RelativeTime date={lastActivity.createdAt} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4 stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Completed (30d)" value={completedThirtyDays.toString()} />
        <StatTile label="Completed (all-time)" value={completedAllTime.toString()} />
        <StatTile label="Avg. time in progress" value={avgDaysInProgress ?? "—"} />
        <div
          className="rounded-xl p-4"
          style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
        >
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Open workload</p>
          <p className="text-2xl font-bold text-text-primary mb-2">{openTotal}</p>
          <div className="flex gap-1">
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => {
              const count = priorityMap[p] ?? 0;
              if (!count) return null;
              const colors = { URGENT: "#D1495B", HIGH: "#D9713C", MEDIUM: "#C79A3D", LOW: "hsl(var(--muted-foreground))" };
              const pct = openTotal > 0 ? (count / openTotal) * 100 : 0;
              return (
                <div
                  key={p}
                  className="h-1.5 rounded-full"
                  style={{ width: `${pct}%`, background: colors[p] }}
                  title={`${p}: ${count}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity heatmap */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-4">Activity — last 12 months</h2>
        <ActivityHeatmap data={Object.fromEntries(heatmapData)} />
      </div>

      {/* Recent activity feed */}
      <div
        className="rounded-xl p-5"
        style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-4">Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5B5FEF]/60 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/board/${log.ticket.boardId}`}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors font-mono line-clamp-1"
                  >
                    {log.ticket.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {formatActivityAction(log)}
                  </p>
                </div>
                <RelativeTime date={log.createdAt} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
    >
      <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
    </div>
  );
}

function formatActivityAction(log: { action: string; fromValue: string | null; toValue: string | null }): string {
  switch (log.action) {
    case "CREATED": return "Created this ticket";
    case "MOVED": return `Moved: ${log.fromValue ?? "?"} → ${log.toValue ?? "?"}`;
    case "ASSIGNED": return `Assigned to ${log.toValue ?? "someone"}`;
    case "UNASSIGNED": return "Unassigned";
    case "COMMENTED": return "Left a comment";
    case "EDITED": return "Edited";
    case "COMPLETED": return "Marked complete";
    case "REOPENED": return "Reopened";
    case "PRIORITY_CHANGED": return `Priority: ${log.fromValue ?? "?"} → ${log.toValue ?? "?"}`;
    case "DUE_DATE_CHANGED": return "Changed due date";
    case "LABEL_ADDED": return `Added label: ${log.toValue ?? "?"}`;
    case "LABEL_REMOVED": return `Removed label: ${log.fromValue ?? "?"}`;
    default: return "Updated";
  }
}
