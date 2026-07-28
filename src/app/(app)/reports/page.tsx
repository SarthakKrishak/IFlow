import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportsClient } from "./ReportsClient";
import { getActiveProject } from "@/lib/project";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports - IFlow" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const activeProject = await getActiveProject();
  if (!activeProject) return <div>No active project</div>;

  const params = await searchParams;
  const range = params.range ?? "30d";

  const now = new Date();
  let startDate: Date;
  let intervals = 4;
  let intervalMs = 0;
  let intervalLabel = "Week";
  
  switch (range) {
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      intervals = 7;
      intervalMs = 24 * 60 * 60 * 1000;
      intervalLabel = "Day";
      break;
    default: // 30d
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      intervals = 4;
      intervalMs = 7 * 24 * 60 * 60 * 1000;
      intervalLabel = "Week";
  }

  const baseFilter = { 
    board: { projectId: activeProject.id },
  };

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, avatarColor: true }
  });

  const [
    createdCount,
    completedInRange,
    overdueTickets,
    completedTickets,
  ] = await Promise.all([
    prisma.ticket.count({
      where: { ...baseFilter, createdAt: { gte: startDate } },
    }),
    prisma.ticket.count({
      where: { ...baseFilter, completedAt: { gte: startDate } },
    }),
    prisma.ticket.findMany({
      where: {
        ...baseFilter,
        dueDate: { lt: now },
        completedAt: null,
      },
      include: {
        assignee: { select: { id: true, displayName: true, avatarColor: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    // Tickets with completion time and due dates for productivity stats
    prisma.ticket.findMany({
      where: {
        ...baseFilter,
        completedAt: { gte: startDate },
        assigneeId: { not: null }
      },
      select: { createdAt: true, completedAt: true, dueDate: true, assigneeId: true },
    })
  ]);

  // Compute avg cycle time
  let avgCycleTime = "—";
  if (completedTickets.length > 0) {
    const totalMs = completedTickets.reduce((sum, t) => {
      if (!t.completedAt) return sum;
      return sum + (t.completedAt.getTime() - t.createdAt.getTime());
    }, 0);
    const avgDays = totalMs / completedTickets.length / (1000 * 60 * 60 * 24);
    avgCycleTime = avgDays.toFixed(1) + "d";
  }

  // Generate chart data: for each interval, for each user, what is their productivity score?
  // Productivity Score = (On Time / Total) * 100
  // If total is 0, score is null or 0. Let's do % of completed tasks.
  const chartData = [];
  
  for (let i = 0; i < intervals; i++) {
    const intStart = new Date(startDate.getTime() + (i * intervalMs));
    const intEnd = new Date(startDate.getTime() + ((i + 1) * intervalMs));
    const label = `${intervalLabel} ${i + 1}`;
    
    const intervalData: any = { name: label };
    
    users.forEach(u => {
      const userTickets = completedTickets.filter(t => 
        t.assigneeId === u.id && 
        t.completedAt! >= intStart && 
        t.completedAt! < intEnd
      );
      
      intervalData[u.displayName] = userTickets.length;
    });
    
    chartData.push(intervalData);
  }

  return (
    <ReportsClient
      stats={{ createdCount, completedInRange, overdueCount: overdueTickets.length, avgCycleTime }}
      overdueTickets={overdueTickets}
      chartData={chartData}
      users={users}
      currentRange={range}
    />
  );
}
