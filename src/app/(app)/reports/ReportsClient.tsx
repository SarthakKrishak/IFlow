"use client";

import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { PriorityChip, Avatar } from "@/components/shared";
import type { Ticket, User } from "@prisma/client";

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
  chartData: any[];
  users: Pick<User, "id" | "displayName" | "avatarColor">[];
  currentRange: string;
}

export function ReportsClient({
  stats,
  overdueTickets,
  chartData,
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Reports</h1>
        <p className="text-sm text-text-secondary mt-0.5">Team throughput and productivity scores</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex rounded-2xl border border-surface-border overflow-hidden">
          {[
            { label: "Last 7 Days", value: "week" },
            { label: "Last 4 Weeks", value: "30d" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam("range", opt.value)}
              className={`px-3 py-2 text-sm transition-colors ${
                currentRange === opt.value
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary bg-surface-elevated"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Created", value: stats.createdCount, color: "hsl(var(--text-secondary))" },
          { label: "Completed", value: stats.completedInRange, color: "#1EAE7C" },
          { label: "Overdue", value: stats.overdueCount, color: stats.overdueCount > 0 ? "#D1495B" : "hsl(var(--text-secondary))" },
          { label: "Avg. cycle time", value: stats.avgCycleTime, color: "#C79A3D" },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-3xl p-4 bg-surface-elevated border border-surface-border shadow-sm"
          >
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">{tile.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: tile.color }}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Productivity chart */}
      <div className="rounded-3xl p-5 mb-6 bg-surface-elevated border border-surface-border shadow-sm">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Individual Productivity Score (%)</h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No productivity data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-border))" vertical={false} opacity={0.5} />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--text-secondary))", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} tickMargin={12} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--text-secondary))", fontSize: 12 }} axisLine={false} tickLine={false} tickMargin={12} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))", borderRadius: 8, color: "hsl(var(--text-primary))", backdropFilter: "blur(8px)", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)" }}
                itemStyle={{ fontWeight: 500 }}
              />
              <Legend verticalAlign="top" height={36}/>
              {users.map((u) => (
                <Line 
                  key={u.id} 
                  type="monotone" 
                  dataKey={u.displayName} 
                  stroke={u.avatarColor} 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2 }} 
                  activeDot={{ r: 6 }} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Overdue tickets */}
      <div className="rounded-3xl overflow-hidden border border-surface-border shadow-sm">
        <div className="px-5 py-3 border-b border-surface-border bg-surface-elevated">
          <h2 className="text-sm font-semibold text-text-primary">
            Overdue tickets
            {overdueTickets.length > 0 && (
              <span className="ml-2 text-xs text-[#D1495B] font-mono">{overdueTickets.length}</span>
            )}
          </h2>
        </div>
        {overdueTickets.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground bg-surface-elevated">
            No overdue tickets — nice work! 🎉
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-surface-elevated/80">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Assignee</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Days overdue</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border bg-surface-elevated">
              {overdueTickets
                .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
                .map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-surface-base transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm text-text-primary font-medium line-clamp-1">{ticket.title}</p>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      {ticket.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            displayName={ticket.assignee.displayName}
                            avatarColor={ticket.assignee.avatarColor}
                            size="sm"
                          />
                          <span className="text-xs text-text-secondary">{ticket.assignee.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm text-[#D1495B] font-medium">
                        {daysOverdue(ticket.dueDate)}d
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <PriorityChip priority={ticket.priority} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
