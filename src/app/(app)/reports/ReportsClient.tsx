"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { PriorityChip, Avatar } from "@/components/shared";
import { Badge, Card, SectionLabel, Segmented } from "@/components/ui";
import type { Ticket, User } from "@prisma/client";
import { FileText, CheckSquare, Clock, Timer, ChevronDown, ChevronLeft, ChevronRight, MessageSquare, LayoutTemplate } from "lucide-react";

interface ReportsClientProps {
  stats: {
    createdCount: number;
    completedInRange: number;
    overdueCount: number;
    avgCycleTime: string;
  };
  overdueTickets: (Ticket & {
    assignee: Pick<User, "id" | "displayName" | "avatarColor"> | null;
  })[];
  velocityData: any[];
  workloadData: any[];
  budgetData: any[];
  users: Pick<User, "id" | "displayName" | "avatarColor">[];
  currentRange: string;
}

export function ReportsClient({
  stats,
  overdueTickets,
  velocityData,
  workloadData,
  budgetData,
  users,
  currentRange,
}: ReportsClientProps) {
  const router = useRouter();

  const updateParam = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    router.push(url.pathname + url.search);
  };

  const daysOverdue = (dueDate: Date | string | null) => {
    if (!dueDate) return 0;
    const diff = new Date().getTime() - new Date(dueDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // RSC serializes Dates to strings — never call .getTime() on props directly.
  // Paginate the (max 50) overdue rows instead of a fake static footer.
  const sortedOverdue = useMemo(
    () =>
      [...overdueTickets].sort(
        (a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()
      ),
    [overdueTickets]
  );
  const OVERDUE_PER_PAGE = 10;
  const [overduePage, setOverduePage] = useState(1);
  const overdueTotalPages = Math.max(1, Math.ceil(sortedOverdue.length / OVERDUE_PER_PAGE));
  const safeOverduePage = Math.min(overduePage, overdueTotalPages);
  const pagedOverdue = sortedOverdue.slice(
    (safeOverduePage - 1) * OVERDUE_PER_PAGE,
    safeOverduePage * OVERDUE_PER_PAGE
  );

  const statCards = [
    {
      id: "created",
      title: "CREATED",
      value: stats.createdCount,
      subtext: "Tickets created",
      icon: <FileText size={20} className="text-indigo-400" />,
      iconBg: "bg-indigo-500/10",
      iconBorder: "border-indigo-500/20"
    },
    {
      id: "completed",
      title: "COMPLETED",
      value: stats.completedInRange,
      subtext: "Tickets completed",
      icon: <CheckSquare size={20} className="text-emerald-400" />,
      iconBg: "bg-emerald-500/10",
      iconBorder: "border-emerald-500/20"
    },
    {
      id: "overdue",
      title: "OVERDUE",
      value: stats.overdueCount,
      valueColor: "text-red-500",
      subtext: "Tickets overdue",
      icon: <Clock size={20} className="text-orange-400" />,
      iconBg: "bg-orange-500/10",
      iconBorder: "border-orange-500/20"
    },
    {
      id: "cycle",
      title: "AVG. CYCLE TIME",
      value: stats.avgCycleTime,
      valueColor: "text-amber-500",
      subtext: "Average time to complete",
      icon: <Timer size={20} className="text-indigo-300" />,
      iconBg: "bg-indigo-500/10",
      iconBorder: "border-indigo-500/20"
    }
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto animate-fade-in pb-24">
      
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Segmented
          value={currentRange as "week" | "30d"}
          onChange={(v) => updateParam("range", v)}
          options={[
            { value: "week", label: "Last 7 days" },
            { value: "30d", label: "Last 4 weeks" },
          ]}
        />
        <p className="text-[12.5px] text-muted-foreground">Team throughput, workload and spend for the selected period</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border shadow-card mb-6">
        {statCards.map((card) => (
          <div key={card.id} className="bg-surface-elevated px-5 py-4 min-w-0">
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground [&_svg]:w-[13px] [&_svg]:h-[13px]">
              {card.icon}
              {card.title}
            </p>
            <p className={`text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums mt-2.5 ${card.valueColor || "text-foreground"}`}>{card.value}</p>
            <p className="text-[12px] text-muted-foreground mt-2 truncate">{card.subtext}</p>
          </div>
        ))}
      </div>

      {/* --- CHARTS GRID --- */}
      
      {/* 1. Team Velocity (Full Width Stacked Bar) */}
      <div className="rounded-xl p-5 mb-6 bg-surface-elevated border border-surface-border shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground mb-0.5">Team Velocity</h2>
            <p className="text-sm text-muted-foreground">Tickets completed per interval</p>
          </div>
          <Badge tone="primary">{currentRange === "week" ? "Last 7 days" : "Last 4 weeks"}</Badge>
        </div>
        
        {velocityData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-medium">
            No productivity data available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" vertical={false} opacity={0.4} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }} 
                  axisLine={{ stroke: "hsl(var(--surface-border))" }} 
                  tickLine={false} 
                  tickMargin={16} 
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={16} 
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--surface-base))', opacity: 0.4 }}
                  contentStyle={{ 
                    background: "hsl(var(--surface-elevated))", 
                    border: "1px solid hsl(var(--surface-border))", 
                    borderRadius: "12px", 
                    color: "hsl(var(--foreground))", 
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                    fontSize: "13px",
                    fontWeight: 600
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px", fontWeight: 600 }} />
                {users.map((u) => (
                  <Bar 
                    key={u.id} 
                    dataKey={u.displayName} 
                    stackId="a" 
                    fill={u.avatarColor}
                    radius={[0, 0, 0, 0]} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Side-by-Side Charts (Workload & Budget) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Workload Distribution (Pie Chart) */}
        <div className="rounded-xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold text-foreground mb-0.5">Workload Distribution</h2>
            <p className="text-sm text-muted-foreground">Active tickets currently assigned</p>
          </div>
          <div className="h-[280px] w-full flex-grow flex items-center justify-center">
            {workloadData.length === 0 ? (
              <div className="text-muted-foreground text-sm font-medium">No active assigned tickets</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workloadData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {workloadData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      background: "hsl(var(--surface-elevated))", 
                      border: "1px solid hsl(var(--surface-border))", 
                      borderRadius: "12px", 
                      color: "hsl(var(--foreground))",
                      fontWeight: 600
                    }}
                    itemStyle={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Budget Burn Rate (Area Chart) */}
        <div className="rounded-xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-[14px] font-semibold text-foreground mb-0.5">Budget Burn Rate</h2>
            <p className="text-sm text-muted-foreground">Cumulative expenses over time</p>
          </div>
          <div className="h-[280px] w-full flex-grow">
            {budgetData.length === 0 || budgetData[budgetData.length - 1].spend === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-medium">
                No expenses logged in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={budgetData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" vertical={false} opacity={0.4} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }} 
                    axisLine={{ stroke: "hsl(var(--surface-border))" }} 
                    tickLine={false} 
                    tickMargin={12} 
                  />
                  <YAxis 
                    tickFormatter={(val) => `₹${val}`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickMargin={12} 
                  />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Total Spent"]}
                    contentStyle={{ 
                      background: "hsl(var(--surface-elevated))", 
                      border: "1px solid hsl(var(--surface-border))", 
                      borderRadius: "12px", 
                      color: "hsl(var(--foreground))",
                      fontWeight: 600
                    }}
                  />
                  <Area type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Overdue tickets */}
      <div className="rounded-xl border border-surface-border shadow-sm overflow-hidden flex flex-col bg-surface-elevated">
        <div className="px-6 py-5 border-b border-surface-border flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
            Overdue tickets
          </h2>
          {overdueTickets.length > 0 && (
            <span className="text-[13px] text-red-500 font-semibold">{overdueTickets.length}</span>
          )}
        </div>
        
        {overdueTickets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm font-medium text-muted-foreground">
            No overdue tickets — the team is on track.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated">
                  <th className="px-6 py-4 text-[12px] font-medium text-muted-foreground">Title</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-muted-foreground hidden sm:table-cell">Assignee</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-muted-foreground">Days overdue</th>
                  <th className="px-6 py-4 text-[12px] font-medium text-muted-foreground hidden md:table-cell">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {pagedOverdue
                  .map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-surface-hover transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-1.5 h-8 rounded-full bg-red-500/70 flex-shrink-0" aria-hidden="true" />
                          <p className="text-[13.5px] text-foreground font-semibold line-clamp-1">{ticket.title}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        {ticket.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              displayName={ticket.assignee.displayName}
                              avatarColor={ticket.assignee.avatarColor}
                              size="sm"
                            />
                            <span className="text-[13px] font-medium text-muted-foreground">{ticket.assignee.displayName}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] font-medium text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-[13px] text-red-500">
                          {daysOverdue(ticket.dueDate)}d
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <PriorityChip priority={ticket.priority} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Footer */}
        {sortedOverdue.length > 0 && (
          <div className="px-6 py-4 border-t border-surface-border flex items-center justify-between bg-surface-elevated">
            <span className="text-[12px] font-medium text-muted-foreground">
              Showing {(safeOverduePage - 1) * OVERDUE_PER_PAGE + 1} to {Math.min(safeOverduePage * OVERDUE_PER_PAGE, sortedOverdue.length)} of {sortedOverdue.length} results
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOverduePage((p) => Math.max(1, p - 1))}
                disabled={safeOverduePage === 1}
                aria-label="Previous overdue page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-primary/10 text-primary text-[12px] font-semibold transition-colors">
                {safeOverduePage}
              </span>
              <button
                onClick={() => setOverduePage((p) => Math.min(overdueTotalPages, p + 1))}
                disabled={safeOverduePage === overdueTotalPages}
                aria-label="Next overdue page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
