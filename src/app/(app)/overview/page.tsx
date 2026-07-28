import { getCachedSession, getCachedUsers } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { OverviewDashboard } from "./OverviewDashboard";

export const metadata: Metadata = { title: "Overview - IFlow" };

export default async function OverviewPage(props: { searchParams: Promise<{ range?: string, projectId?: string }> }) {
  const searchParams = await props.searchParams;
  const rangeMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const range = rangeMap[searchParams.range || "7d"] || 7;
  const projectId = searchParams.projectId;
  
  const session = await getCachedSession();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const boardWhere: any = isAdmin ? {} : { members: { some: { id: session.user.id } } };
  
  if (projectId) {
    boardWhere.projectId = projectId;
  }

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - range);
  rangeStart.setHours(0, 0, 0, 0);

  // We optimize this with Promise.all and concurrent queries, just as before.
  const [
    allProjectsData,
    statusGroups,
    activityLogs,
    chartTickets,
    upcomingDeadlines,
    allUsers,
  ] = await Promise.all([
    prisma.project.findMany({
      select: { 
        id: true, 
        name: true, 
        createdAt: true,
        boards: {
          select: {
            id: true,
            tickets: {
              select: {
                id: true,
                column: { select: { name: true, order: true } }
              }
            }
          }
        }
      }
    }),
    prisma.ticket.groupBy({
      by: ["columnId"],
      where: { board: boardWhere },
      _count: { id: true },
    }),
    prisma.activityLog.findMany({
      where: { ticket: { board: boardWhere } },
      include: {
        user: { select: { id: true, displayName: true, avatarColor: true } },
        ticket: { select: { id: true, title: true, board: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.ticket.findMany({
      where: { 
        board: boardWhere, 
        OR: [{ createdAt: { gte: rangeStart } }, { updatedAt: { gte: rangeStart } }] 
      },
      select: { createdAt: true, updatedAt: true, dueDate: true, column: { select: { name: true, order: true } } },
      take: 2000,
    }),
    prisma.ticket.findMany({
      where: { 
        board: boardWhere, 
        dueDate: { gte: new Date() },
        column: { name: { notIn: ["Done", "Completed"] } } 
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        board: { select: { name: true, project: { select: { name: true } } } },
        assignee: { select: { id: true, displayName: true, avatarColor: true } }
      },
      orderBy: { dueDate: "asc" },
      take: 4
    }),
    getCachedUsers()
  ]);

  const allColumnIds = statusGroups.map(g => g.columnId);
  const columnDetails = await prisma.column.findMany({
    where: { id: { in: allColumnIds } },
    select: { id: true, name: true, order: true },
  });
  const columnMap = new Map(columnDetails.map(c => [c.id, c]));

  const openTasksCount = statusGroups
    .filter(g => (columnMap.get(g.columnId)?.order ?? 99) < 2)
    .reduce((sum, g) => sum + g._count.id, 0);
    
  const inProgressCount = statusGroups
    .filter(g => {
      const col = columnMap.get(g.columnId);
      return col?.order === 2 || col?.name.toLowerCase().includes("progress");
    })
    .reduce((sum, g) => sum + g._count.id, 0);
    
  const completedCount = statusGroups
    .filter(g => columnMap.get(g.columnId)?.name.toLowerCase().includes("done"))
    .reduce((sum, g) => sum + g._count.id, 0);

  const projectsFormatted = allProjectsData.map(p => {
    let totalTasks = 0;
    let completedTasks = 0;
    let openTasks = 0;
    
    p.boards.forEach(b => {
      b.tickets.forEach(t => {
        totalTasks++;
        if (t.column?.name.toLowerCase().includes("done")) completedTasks++;
        else openTasks++;
      });
    });

    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    let status: 'On Track' | 'At Risk' | 'Behind' = 'On Track';
    if (progress < 30 && openTasks > 10) status = 'Behind';
    else if (progress < 60 && openTasks > 5) status = 'At Risk';

    return {
      id: p.id,
      name: p.name,
      boardsCount: p.boards.length,
      openTasks,
      progress,
      status
    };
  });

  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
  const onlineUsers = allUsers.filter(u => u.lastSeenAt && new Date(u.lastSeenAt) > fiveMinsAgo);

  // Real Sparkline Data Calculation (Last 7 days)
  const sparklineDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const sparklineData = sparklineDays.map(date => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    let created = 0;
    let inProg = 0;
    let done = 0;

    // Filter tickets that were created or updated in this 24hr window
    chartTickets.forEach(t => {
      if (t.createdAt >= date && t.createdAt < nextDay) created++;
      if (t.updatedAt >= date && t.updatedAt < nextDay) {
        if (t.column?.name.toLowerCase().includes("done")) done++;
        if (t.column?.name.toLowerCase().includes("progress")) inProg++;
      }
    });

    return { created, inProg, done };
  });

  const calcTrend = (recent: number, total: number) => {
    const prev = total - recent;
    return prev > 0 ? (recent / prev) * 100 : (recent > 0 ? 100 : 0);
  };

  const recentProjects = allProjectsData.filter(p => p.createdAt >= rangeStart).length;
  
  const recentOpen = chartTickets.filter(t => t.createdAt >= rangeStart && (t.column?.order ?? 99) < 2).length;
  const recentInProgress = chartTickets.filter(t => t.updatedAt >= rangeStart && (t.column?.order === 2 || t.column?.name.toLowerCase().includes("progress"))).length;
  const recentCompleted = chartTickets.filter(t => t.updatedAt >= rangeStart && t.column?.name.toLowerCase().includes("done")).length;

  const topStats = {
    totalProjects: allProjectsData.length,
    openTasks: openTasksCount,
    inProgress: inProgressCount,
    completed: completedCount,
    sparklines: sparklineData,
    trends: {
      projects: calcTrend(recentProjects, allProjectsData.length),
      open: calcTrend(recentOpen, openTasksCount),
      inProgress: calcTrend(recentInProgress, inProgressCount),
      completed: calcTrend(recentCompleted, completedCount),
    }
  };

  const recentUsers = allUsers.filter(u => new Date(u.createdAt) >= rangeStart).length;
  const userTrend = calcTrend(recentUsers, allUsers.length);

  // Calculate workload balance
  const openAssignedTickets = await prisma.ticket.findMany({
    where: { 
       board: boardWhere, 
       column: { name: { notIn: ["Done", "Completed"] } },
       assigneeId: { not: null }
    },
    select: { assigneeId: true }
  });

  const workloadCounts: Record<string, number> = {};
  openAssignedTickets.forEach(t => {
    if (t.assigneeId) {
      workloadCounts[t.assigneeId] = (workloadCounts[t.assigneeId] || 0) + 1;
    }
  });

  const workloads = Object.values(workloadCounts);
  let balanceScore = 100;
  let balanceText = "Good balance across the team";
  if (workloads.length > 0) {
    const max = Math.max(...workloads);
    const min = Math.min(...workloads);
    const avg = workloads.reduce((a, b) => a + b, 0) / workloads.length;
    
    if (max - min > 5 && max > avg * 1.5) {
      balanceScore = Math.max(0, 100 - (max - min) * 5);
      balanceText = "Uneven workload distribution";
    } else if (max - min > 2) {
      balanceScore = Math.max(50, 100 - (max - min) * 3);
      balanceText = "Moderate balance across the team";
    } else {
      balanceScore = 95;
    }
  } else {
    balanceScore = 100;
    balanceText = "No assigned tasks right now";
  }

  const teamStats = {
    total: allUsers.length,
    online: onlineUsers,
    all: allUsers,
    trend: userTrend,
    balanceScore,
    balanceText,
  };

  return (
    <div className="w-full h-full bg-surface-base text-foreground"> 
      {/* We pass all the computed data down to the Client Component which will handle interactivity */}
      <OverviewDashboard 
        stats={topStats}
        projects={projectsFormatted}
        activityLogs={activityLogs}
        chartTickets={chartTickets}
        upcomingDeadlines={upcomingDeadlines}
        teamStats={teamStats}
        range={range}
        projectId={projectId}
      />
    </div>
  );
}
