import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { Folder, CheckCircle, Clock, CheckCircle2, MoreVertical, ArrowUp } from "lucide-react";
import { DashboardChart } from "../dashboard/DashboardChart";
import { Avatar } from "@/components/shared";
import Link from "next/link";

export const metadata: Metadata = { title: "Overview - IFlow" };

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  const isAdmin = session.user.role === "ADMIN";
  const boardWhere = isAdmin ? {} : { members: { some: { id: session.user.id } } };

  // Fetch all necessary data globally
  const [tickets, allProjects, activityLogs] = await Promise.all([
    prisma.ticket.findMany({
      where: { board: boardWhere },
      include: {
        assignee: { select: { id: true, displayName: true, avatarColor: true } },
        labels: { select: { id: true, name: true, color: true } },
        column: { select: { name: true, order: true } },
        board: { select: { id: true, name: true } },
      },
      orderBy: { lastActivityAt: "desc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, _count: { select: { boards: true } } }
    }),
    prisma.activityLog.findMany({
      where: { ticket: { board: boardWhere } },
      include: {
        user: { select: { id: true, displayName: true, avatarColor: true } },
        ticket: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  // Statistics
  const openTasksCount = tickets.filter(t => t.column.order < 2).length; 
  const inProgressCount = tickets.filter(t => t.column.order === 2 || t.column.name.toLowerCase().includes("progress")).length;
  const completedCount = tickets.filter(t => t.column.name.toLowerCase().includes("done")).length;

  const columnsGroups = [
    { name: "To Do", count: openTasksCount, color: "bg-slate-400 dark:bg-slate-500", items: tickets.filter(t => t.column.order < 2).slice(0, 4) },
    { name: "In Progress", count: inProgressCount, color: "bg-blue-500", items: tickets.filter(t => t.column.order === 2 || t.column.name.toLowerCase().includes("progress")).slice(0, 4) },
    { name: "Review", count: tickets.filter(t => t.column.name.toLowerCase().includes("review")).length, color: "bg-yellow-500", items: tickets.filter(t => t.column.name.toLowerCase().includes("review")).slice(0, 4) },
    { name: "Done", count: completedCount, color: "bg-green-500", items: tickets.filter(t => t.column.name.toLowerCase().includes("done")).slice(0, 4) }
  ];

  const chartData = [
    { name: "Mon", completed: 10, created: 5 },
    { name: "Tue", completed: 15, created: 8 },
    { name: "Wed", completed: 21, created: 10 },
    { name: "Thu", completed: 18, created: 8 },
    { name: "Fri", completed: 23, created: 9 },
    { name: "Sat", completed: 19, created: 8 },
    { name: "Sun", completed: 29, created: 16 },
  ];

  const formatRelativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-5 transition-colors duration-300">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Folder size={24} />
          </div>
          <div>
            <p className="text-[14px] text-muted-foreground font-medium">Total Projects</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{allProjects.length}</span>
            </div>
            <p className="text-[12px] text-green-500 flex items-center gap-1 mt-1 font-medium"><ArrowUp size={12} /> 10% <span className="text-muted-foreground font-normal">vs last month</span></p>
          </div>
        </div>
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-5 transition-colors duration-300">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-[14px] text-muted-foreground font-medium">Global Open Tasks</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{openTasksCount}</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-5 transition-colors duration-300">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[14px] text-muted-foreground font-medium">Global In Progress</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{inProgressCount}</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-5 shadow-sm flex items-center gap-5 transition-colors duration-300">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[14px] text-muted-foreground font-medium">Global Completed</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-foreground">{completedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview Chart */}
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 shadow-sm lg:col-span-2 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-bold text-foreground">Global Activity Overview</h2>
          </div>
          <DashboardChart data={chartData} />
        </div>

        {/* Projects List */}
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-bold text-foreground">All Projects</h2>
            <Link href="#" className="text-[13px] font-medium text-primary">View All</Link>
          </div>
          <div className="space-y-6">
            {allProjects.map((p, i) => {
              const colors = ["#4F46E5", "#2563EB", "#F43F5E", "#F97316"];
              const progress = [75, 60, 40, 25];
              return (
                <div key={p.id} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-foreground line-clamp-1">{p.name}</p>
                      <p className="text-[12px] text-muted-foreground">{p._count.boards} boards</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-surface-base">
                      <div className="h-full rounded-full" style={{ width: `${progress[i % progress.length]}%`, backgroundColor: colors[i % colors.length] }}></div>
                    </div>
                    <span className="text-[12px] font-medium text-muted-foreground w-8">{progress[i % progress.length]}%</span>
                    <button className="text-muted-foreground hover:text-foreground"><MoreVertical size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 shadow-sm lg:col-span-2 transition-colors duration-300">
          <h2 className="text-[16px] font-bold text-foreground mb-6">Global Task Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {columnsGroups.map(col => (
              <div key={col.name} className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                    <span className="text-[14px] font-semibold text-foreground">{col.name}</span>
                  </div>
                  <span className="text-[12px] font-medium text-muted-foreground bg-surface-base px-2 py-0.5 rounded-md border border-surface-border">{col.count}</span>
                </div>
                <div className="space-y-2 flex-1">
                  {col.items.map(t => (
                    <div key={t.id} className="p-3 bg-surface-base border border-surface-border rounded-xl shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
                      <p className="text-[13px] font-medium text-foreground line-clamp-1">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">in {t.board.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-bold text-foreground">Global Recent Activity</h2>
            <Link href="#" className="text-[13px] font-medium text-primary">View All</Link>
          </div>
          <div className="space-y-5">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <Avatar displayName={log.user.displayName} avatarColor={log.user.avatarColor} size="sm" />
                <div>
                  <p className="text-[13px] text-foreground leading-snug">
                    <span className="font-semibold">{log.user.displayName}</span> {log.action.toLowerCase().replace('_', ' ')} <span className="font-medium text-muted-foreground">"{log.ticket.title}"</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
