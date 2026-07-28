import { getCachedSession, getCachedActiveProject } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { PeopleClient } from "./PeopleClient";

export const metadata: Metadata = { title: "People - IFlow" };

export default async function PeoplePage() {
  const session = await getCachedSession();
  if (!session?.user) return null;

  const activeProject = await getCachedActiveProject();
  if (!activeProject) return <div>No active project</div>;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // All 4 queries run simultaneously instead of sequentially
  const [users, allBoards, completedThisMonth, completedWithDueDates] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            ticketsAssigned: {
              where: { completedAt: null, board: { projectId: activeProject.id } },
            },
          },
        },
        activityLogs: {
          where: { ticket: { board: { projectId: activeProject.id } } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        accessibleBoards: { select: { id: true } }
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.board.findMany({
      where: { projectId: activeProject.id },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.ticket.groupBy({
      by: ["assigneeId"],
      where: {
        board: { projectId: activeProject.id },
        completedAt: { gte: startOfMonth },
        assigneeId: { not: null },
      },
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: {
        board: { projectId: activeProject.id },
        assigneeId: { not: null },
        completedAt: { not: null },
        dueDate: { not: null },
      },
      select: { assigneeId: true, completedAt: true, dueDate: true }
    }),
  ]);

  const completedMap = new Map(completedThisMonth.map((r) => [r.assigneeId!, r._count.id]));

  const productivityMap = new Map<string, { total: number; onTime: number }>();
  for (const t of completedWithDueDates) {
    if (!t.assigneeId) continue;
    if (!productivityMap.has(t.assigneeId)) {
      productivityMap.set(t.assigneeId, { total: 0, onTime: 0 });
    }
    const stats = productivityMap.get(t.assigneeId)!;
    stats.total += 1;
    if (t.completedAt! <= t.dueDate!) {
      stats.onTime += 1;
    }
  }

  const initialUsers = users.map(user => ({
    id: user.id,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    department: user.department,
    role: user.role,
    assignedCount: user._count.ticketsAssigned,
    completedCount: completedMap.get(user.id) ?? 0,
    prodStats: productivityMap.get(user.id) || null,
    lastActivity: user.activityLogs[0]?.createdAt ?? null,
    lastSeenAt: user.lastSeenAt,
    boardIds: user.accessibleBoards.map(b => b.id)
  }));

  return (
    <PeopleClient 
      initialUsers={initialUsers} 
      isAdmin={session.user.role === 'ADMIN'}
      currentUserId={session.user.id}
      boards={allBoards}
    />
  );
}
