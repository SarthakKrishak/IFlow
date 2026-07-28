"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Folder, 
  CheckCircle2, 
  Clock, 
  Calendar,
  MessageSquare,
  CheckCircle,
  Tag,
  ArrowRightLeft,
  Loader2
} from "lucide-react";
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
import Link from "next/link";
import { Avatar } from "@/components/shared/Avatar";

interface OverviewProps {
  stats: {
    totalProjects: number;
    openTasks: number;
    inProgress: number;
    completed: number;
    sparklines: { created: number; inProg: number; done: number; }[];
    trends: {
      projects: number;
      open: number;
      inProgress: number;
      completed: number;
    };
  };
  projects: any[];
  activityLogs: any[];
  chartTickets: any[];
  upcomingDeadlines: any[];
  teamStats: {
    total: number;
    online: any[];
    all: any[];
    trend: number;
    balanceScore: number;
    balanceText: string;
  };
  range: number;
  projectId?: string;
}

export function OverviewDashboard({
  stats,
  projects,
  activityLogs,
  chartTickets,
  upcomingDeadlines,
  teamStats,
  range,
  projectId,
}: OverviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visibleActivities, setVisibleActivities] = useState(6);
  const activityScrollRef = useRef<HTMLDivElement>(null);
  
  // Format Chart Data
  const chartDays = Array.from({ length: range }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - ((range - 1) - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const chartData = chartDays.map(date => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    let created = 0;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;

    chartTickets.forEach(t => {
      if (t.createdAt >= date && t.createdAt < nextDay) created++;
      if (t.column?.name.toLowerCase().includes("done") && t.updatedAt >= date && t.updatedAt < nextDay) completed++;
      if ((t.column?.name.toLowerCase().includes("progress") || t.column?.name.toLowerCase().includes("review")) && t.updatedAt >= date && t.updatedAt < nextDay) inProgress++;
      if (t.dueDate && new Date(t.dueDate) < new Date() && !t.column?.name.toLowerCase().includes("done") && t.updatedAt >= date && t.updatedAt < nextDay) overdue++;
    });

    return {
      fullDate: date.toLocaleDateString("en-US", { weekday: 'short', day: 'numeric', month: 'short' }),
      name: date.toLocaleDateString("en-US", { weekday: "short" }),
      Created: created,
      Completed: completed,
      "In Progress": inProgress,
      Overdue: overdue,
    };
  });

  const updateRange = (r: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("range", r);
      router.push(url.pathname + url.search);
    });
  };

  const updateProject = (pid: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      if (pid) url.searchParams.set("projectId", pid);
      else url.searchParams.delete("projectId");
      router.push(url.pathname + url.search);
    });
  };

  const handleActivityScroll = () => {
    if (activityScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = activityScrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        // load more if available
        if (visibleActivities < activityLogs.length) {
          setVisibleActivities(prev => Math.min(prev + 6, activityLogs.length));
        }
      }
    }
  };

  const formatTimeAgo = (date: Date) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Pre-calculate sparklines for each card from the 7-day stats
  const projectsSparkData = stats.sparklines.map(s => s.created);
  const openTasksSparkData = stats.sparklines.map(s => s.created - s.done);
  const inProgressSparkData = stats.sparklines.map(s => s.inProg);
  const completedSparkData = stats.sparklines.map(s => s.done);

  const rangeText = range === 7 ? "week" : range === 30 ? "month" : "quarter";
  const formatTrend = (val: number) => ({
    text: `${val >= 0 ? "+" : "-"} ${Math.abs(Math.round(val))}% vs last ${rangeText}`,
    isUp: val >= 0
  });

  const tProj = formatTrend(stats.trends.projects);
  const tOpen = formatTrend(stats.trends.open);
  const tProg = formatTrend(stats.trends.inProgress);
  const tComp = formatTrend(stats.trends.completed);

  return (
    <div id="dashboard-content" className="px-4 sm:px-6 lg:px-8 pt-4 pb-20 max-w-[1500px] mx-auto space-y-6 animate-fade-in">
      
      {/* Header & Filters */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <select 
            value={projectId || ""}
            onChange={(e) => updateProject(e.target.value)}
            className="bg-surface-elevated border border-surface-border text-foreground text-[13px] font-semibold rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
          title="Total Projects" 
          value={stats.totalProjects} 
          trend={tProj.text} 
          trendUp={tProj.isUp} 
          icon={<Folder size={24} className="text-blue-500" />} 
          sparklineColor="#3B82F6"
          dataPoints={projectsSparkData}
        />
        <StatCard 
          title="Open Tasks" 
          value={stats.openTasks} 
          trend={tOpen.text} 
          trendUp={tOpen.isUp} 
          icon={<CheckCircle2 size={24} className="text-emerald-500" />} 
          sparklineColor="#10B981"
          dataPoints={openTasksSparkData}
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          trend={tProg.text} 
          trendUp={tProg.isUp} 
          icon={<Clock size={24} className="text-orange-500" />} 
          sparklineColor="#F59E0B"
          dataPoints={inProgressSparkData}
        />
        <StatCard 
          title="Completed" 
          value={stats.completed} 
          trend={tComp.text} 
          trendUp={tComp.isUp} 
          icon={<CheckCircle size={24} className="text-purple-500" />} 
          sparklineColor="#8B5CF6"
          dataPoints={completedSparkData}
        />
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Overview Chart */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm xl:col-span-2 flex flex-col relative">
          {isPending && (
            <div className="absolute inset-0 bg-surface-base/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-[17px] font-bold text-foreground">Activity Overview</h2>
            
            <div className="flex items-center self-start sm:self-auto bg-surface-base border border-surface-border rounded-xl p-1">
              {[
                { label: "7D", value: "7d", active: range === 7 },
                { label: "30D", value: "30d", active: range === 30 },
                { label: "90D", value: "90d", active: range === 90 }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateRange(opt.value)}
                  className={`px-4 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                    opt.active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-border" vertical={false} opacity={0.4} />
                <XAxis dataKey="name" tick={{ fill: "currentColor", className: "text-muted-foreground", fontSize: 12 }} axisLine={false} tickLine={false} tickMargin={15} />
                <YAxis tick={{ fill: "currentColor", className: "text-muted-foreground", fontSize: 12 }} axisLine={false} tickLine={false} tickMargin={15} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }} />
                
                <Line type="monotone" dataKey="Created" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Completed" stroke="#10B981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="In Progress" stroke="#F59E0B" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Overdue" stroke="#EF4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col">
          <h2 className="text-[17px] font-bold text-foreground mb-6">Projects</h2>
          
          <div className="grid grid-cols-12 text-[12px] font-semibold text-muted-foreground mb-4 px-2">
            <div className="col-span-5">Project</div>
            <div className="col-span-2 text-center">Boards</div>
            <div className="col-span-2 text-center">Open</div>
            <div className="col-span-3 text-right">Completed</div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 max-h-[380px]">
            {projects.map((p, i) => {
              const colors = ["bg-indigo-600", "bg-blue-600", "bg-emerald-500"];
              return (
                <div key={p.id} className="grid grid-cols-12 items-center text-[13px] hover:bg-surface-base p-2 rounded-xl transition-colors cursor-pointer group">
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${colors[i % colors.length]}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-foreground line-clamp-1">{p.name}</span>
                  </div>
                  <div className="col-span-2 text-center text-muted-foreground font-medium">{p.boardsCount || 0}</div>
                  <div className="col-span-2 text-center text-muted-foreground font-medium">{p.openTasks || 0}</div>
                  <div className="col-span-3 flex items-center justify-end gap-3">
                    <span className="font-medium text-foreground">{p.progress}%</span>
                    <div className="w-16 h-1.5 rounded-full bg-surface-border">
                      <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.progress > 50 ? '#8B5CF6' : (p.progress > 30 ? '#3B82F6' : '#EF4444') }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Recent Activity */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col">
          <h2 className="text-[17px] font-bold text-foreground mb-6">Recent Activity</h2>
          
          <div 
            className="flex-1 overflow-y-auto custom-scrollbar relative pl-2 max-h-[350px] -mr-4 pr-4" 
            ref={activityScrollRef}
            onScroll={handleActivityScroll}
          >
             <div className="absolute top-2 bottom-2 left-[19px] w-px bg-surface-border"></div>
             <div className="space-y-6 pb-4">
                {activityLogs.slice(0, visibleActivities).map((log) => (
                  <div key={log.id} className="flex gap-4 relative z-10">
                    <div className="flex-shrink-0 relative">
                       <Avatar
                         name={log.user.displayName}
                         color={log.user.avatarColor}
                         size="md"
                       />
                       <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-elevated border-2 border-surface-elevated flex items-center justify-center text-muted-foreground">
                         <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white">
                           {getTimelineIcon(log.action)}
                         </div>
                       </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1 flex justify-between gap-2">
                       <p className="text-[13px] text-muted-foreground leading-snug truncate">
                         <span className="font-bold text-foreground">{log.user.displayName}</span> {log.action.toLowerCase().replace('_', ' ')} <span className="text-foreground">"{log.ticket.title}"</span>
                         <br />
                         <span className="text-[11px] mt-0.5 inline-block opacity-70">{log.ticket.board.name}</span>
                       </p>
                       <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTimeAgo(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col">
          <h2 className="text-[17px] font-bold text-foreground mb-6">Upcoming Deadlines</h2>
          <div className="flex-1 space-y-4">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            ) : upcomingDeadlines.map((ticket, i) => {
              const d = new Date(ticket.dueDate);
              const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
              const day = d.toLocaleDateString("en-US", { day: "2-digit" });
              const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isToday = diffDays <= 0;
              const colors = ["bg-indigo-600", "bg-blue-600", "bg-emerald-500", "bg-purple-600"];

              return (
                <div key={ticket.id} className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-surface-base border border-surface-border flex-shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">{month}</span>
                    <span className="text-[16px] font-bold text-foreground leading-none">{day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-foreground truncate">{ticket.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{ticket.board.name} • {ticket.board.project.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[12px] font-bold ${isToday ? 'text-emerald-500' : 'text-orange-500'}`}>
                      {isToday ? 'Today' : `In ${diffDays} days`}
                    </span>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${colors[i % colors.length]}`}>
                      {ticket.board.project.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="#" className="text-[13px] font-semibold text-primary mt-6 inline-block hover:underline">
            + View calendar
          </Link>
        </div>

        {/* Team Overview */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col">
          <h2 className="text-[17px] font-bold text-foreground mb-6">Team Overview</h2>
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[12px] font-semibold text-muted-foreground mb-1">Total Members</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{teamStats.total}</span>
                {teamStats.trend !== 0 && (
                  <span className={`text-[11px] font-bold ${teamStats.trend > 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {teamStats.trend > 0 ? "↑" : "↓"} {Math.abs(Math.round(teamStats.trend))}% vs last {rangeText}
                  </span>
                )}
              </div>
            </div>
            {/* Avatar Pile using real Avatars */}
            <div className="flex -space-x-3 relative">
              {teamStats.all.slice(0, 5).map(u => (
                <div key={u.id} className="ring-4 ring-surface-elevated rounded-full">
                  <Avatar name={u.displayName} color={u.avatarColor} size="sm" />
                </div>
              ))}
              {teamStats.all.length > 5 && (
                <div className="w-8 h-8 rounded-full ring-4 ring-surface-elevated flex items-center justify-center bg-surface-border text-foreground text-[11px] font-bold shadow-sm z-10">
                  +{teamStats.all.length - 5}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[13px] font-bold text-foreground">Active Now</p>
              </div>
              <p className="text-[12px] text-muted-foreground">{teamStats.online.length} members online</p>
            </div>
            <div className="flex -space-x-3">
              {teamStats.online.slice(0, 4).map(u => (
                <div key={u.id} className="relative ring-4 ring-surface-elevated rounded-full group">
                  <Avatar name={u.displayName} color={u.avatarColor} size="sm" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-1 ring-surface-base"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-surface-border pt-6">
             <div>
               <p className="text-[14px] font-bold text-foreground mb-1">Workload Balance</p>
               <p className="text-[12px] text-muted-foreground">{teamStats.balanceText}</p>
             </div>
             {/* Circular Progress */}
             <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-surface-border" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className={`${teamStats.balanceScore > 80 ? 'text-emerald-500' : teamStats.balanceScore > 50 ? 'text-orange-500' : 'text-red-500'} drop-shadow-md`} strokeDasharray={`${Math.round(teamStats.balanceScore)}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="absolute text-[14px] font-bold text-foreground">{Math.round(teamStats.balanceScore)}%</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Map real data array into a polyline sparkline
function Sparkline({ color, dataPoints = [] }: { color: string, dataPoints?: number[] }) {
  const max = Math.max(...dataPoints, 5); // at least 5 for scale
  
  // Create 7 points distributed horizontally across 80px
  let pathString = "M0 25";
  if (dataPoints.length > 0) {
    pathString = dataPoints.map((val, i) => {
      const x = i * (80 / Math.max(dataPoints.length - 1, 1));
      const y = 25 - (val / max) * 20; // 5 to 25 range
      if (i === 0) return `M0 ${y}`;
      return `L ${x} ${y}`;
    }).join(" ");
  }

  return (
    <div className="w-[80px] h-[30px] flex items-end justify-end flex-shrink-0 opacity-80">
      <svg width="80" height="30" viewBox="0 0 80 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={pathString} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${pathString} L 80 30 L 0 30 Z`} fill={`url(#gradient-${color.replace('#','')})`} opacity="0.2" />
        <defs>
          <linearGradient id={`gradient-${color.replace('#','')}`} x1="40" y1="0" x2="40" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, sparklineColor, dataPoints }: { title: string, value: number, trend: string, trendUp: boolean, icon: React.ReactNode, sparklineColor: string, dataPoints: number[] }) {
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-primary/30 group">
      <div className="flex items-start justify-between mb-2">
        <div className="w-12 h-12 rounded-2xl bg-surface-base border border-surface-border flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <Sparkline color={sparklineColor} dataPoints={dataPoints} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-muted-foreground mb-1">{title}</p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-foreground">{value}</span>
        </div>
        <p className={`text-[12px] font-bold mt-2 ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} {trend} <span className="text-muted-foreground font-medium">vs last week</span>
        </p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-elevated border border-surface-border p-4 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-[13px] font-bold text-foreground mb-3">{payload[0].payload.fullDate}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 text-[12px] font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

const getTimelineIcon = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes("comment")) return <MessageSquare size={10} />;
  if (a.includes("move")) return <ArrowRightLeft size={10} />;
  if (a.includes("complete") || a.includes("done")) return <CheckCircle size={10} />;
  if (a.includes("label")) return <Tag size={10} />;
  return <CheckCircle size={10} />;
};
