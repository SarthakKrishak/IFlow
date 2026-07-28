import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ProfileClient } from "@/components/people/ProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Profile — IFlow" };

export default async function MyProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      department: true,
      role: true,
      avatarColor: true,
      isActive: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (!user) notFound();

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  // Parallel data fetching
  const [
    currentOpenTickets,
    lastActivity,
    activityLogsForHeatmap,
    recentActivity,
    inProgressLogs,
  ] = await Promise.all([
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
    <ProfileClient
      user={user}
      openTotal={openTotal}
      priorityMap={priorityMap}
      avgDaysInProgress={avgDaysInProgress}
      heatmapData={Object.fromEntries(heatmapData)}
      recentActivity={recentActivity}
      lastActivity={lastActivity}
    />
  );
}
