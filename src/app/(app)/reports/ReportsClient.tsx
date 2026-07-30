"use client";

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

  const daysOverdue = (dueDate: Date | null) => {
    if (!dueDate) return 0;
    const diff = new Date().getTime() - new Date(dueDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

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
    <div className="p-8 max-w-[1500px] mx-auto animate-fade-in pb-24">
      
      {/* Controls */}
      <div className="flex mb-8">
        <div className="flex bg-surface-elevated/50 p-1.5 rounded-full border border-surface-border">
          {[
            { label: "Last 7 Days", value: "week" },
            { label: "Last 4 Weeks", value: "30d" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam("range", opt.value)}
              className={`px-5 py-2 text-[13px] font-bold rounded-full transition-all ${
                currentRange === opt.value
                  ? "bg-primary text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statCards.map((card) => (
          <div
            key={card.id}
            className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-center gap-5 hover:border-surface-border/80 transition-colors"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border flex-shrink-0 ${card.iconBg} ${card.iconBorder}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold tracking-wider mb-1 uppercase">{card.title}</p>
              <p className={`text-3xl font-bold font-mono tracking-tight ${card.valueColor || "text-foreground"}`}>
                {card.value}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">{card.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* --- CHARTS GRID --- */}
      
      {/* 1. Team Velocity (Full Width Stacked Bar) */}
      <div className="rounded-3xl p-6 mb-6 bg-surface-elevated border border-surface-border shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight mb-1">Team Velocity</h2>
            <p className="text-sm text-muted-foreground">Tickets completed per interval</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-border bg-surface-base text-foreground text-[12px] font-bold hover:border-primary/50 transition-colors">
            {currentRange === "week" ? "Last 7 Days" : "Last 4 Weeks"}
            <ChevronDown size={14} className="text-muted-foreground ml-1" />
          </button>
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
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground tracking-tight mb-1">Workload Distribution</h2>
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
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground tracking-tight mb-1">Budget Burn Rate</h2>
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
      <div className="rounded-3xl border border-surface-border shadow-sm overflow-hidden flex flex-col bg-surface-elevated">
        <div className="px-6 py-5 border-b border-surface-border flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-foreground tracking-tight">
            Overdue tickets
          </h2>
          {overdueTickets.length > 0 && (
            <span className="text-[13px] text-red-500 font-bold">{overdueTickets.length}</span>
          )}
        </div>
        
        {overdueTickets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm font-medium text-muted-foreground">
            No overdue tickets — nice work! 🎉
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated">
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Assignee</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Days overdue</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {overdueTickets
                  .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
                  .map((ticket, i) => (
                    <tr key={ticket.id} className="hover:bg-surface-base transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${i % 2 === 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-teal-500/10 border-teal-500/20 text-teal-400'}`}>
                              {i % 2 === 0 ? <MessageSquare size={18} /> : <LayoutTemplate size={18} />}
                           </div>
                           <p className="text-[14px] text-foreground font-bold line-clamp-1">{ticket.title}</p>
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
                        <span className="font-bold text-[13px] text-red-500">
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
        {overdueTickets.length > 0 && (
          <div className="px-6 py-4 border-t border-surface-border flex items-center justify-between bg-surface-elevated">
            <span className="text-[12px] font-medium text-muted-foreground">
              Showing 1 to {overdueTickets.length} of {overdueTickets.length} results
            </span>
            <div className="flex items-center gap-1.5">
              <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border text-muted-foreground hover:bg-surface-base hover:text-foreground transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border bg-primary/10 text-primary font-bold transition-colors">
                1
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center border border-surface-border text-muted-foreground hover:bg-surface-base hover:text-foreground transition-colors disabled:opacity-50" disabled>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
