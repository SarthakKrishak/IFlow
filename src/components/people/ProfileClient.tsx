"use client";

import Link from "next/link";
import { ArrowLeft, Folder, Clock, Calendar as CalendarIcon, Shield, MessageSquare, LayoutTemplate, PenLine, AlertCircle, UserPlus, UserMinus, Tag, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, SectionLabel, StatCard, StatGroup } from "@/components/ui";
import { Avatar, RelativeTime } from "@/components/shared";
import { ActivityHeatmap } from "@/components/people/ActivityHeatmap";
import type { ActivityLog } from "@prisma/client";

interface ProfileClientProps {
  user: {
    id: string;
    displayName: string;
    department: string;
    role: string;
    avatarColor: string;
    isActive: boolean;
    createdAt: Date;
    lastSeenAt: Date | null;
  };
  openTotal: number;
  priorityMap: Record<string, number>;
  avgDaysInProgress: string | null;
  heatmapData: Record<string, number>;
  recentActivity: (ActivityLog & {
    ticket: { id: string; title: string; boardId: string };
    user: { id: string; displayName: string };
  })[];
  lastActivity: { createdAt: Date } | null;
}

export function ProfileClient({
  user,
  openTotal,
  priorityMap,
  avgDaysInProgress,
  heatmapData,
  recentActivity,
  lastActivity,
}: ProfileClientProps) {
  const memberSince = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(user.createdAt));
  const monthsSince = Math.max(1, Math.floor((new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)));

  const formatActivityAction = (log: { action: string; fromValue: string | null; toValue: string | null }) => {
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
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "COMMENTED": return { icon: <MessageSquare size={15} />, tone: "bg-purple-500/10 text-purple-500" };
      case "LABEL_ADDED":
      case "LABEL_REMOVED": return { icon: <Tag size={15} />, tone: "bg-emerald-500/10 text-emerald-500" };
      case "DUE_DATE_CHANGED": return { icon: <PenLine size={15} />, tone: "bg-sky-500/10 text-sky-500" };
      case "PRIORITY_CHANGED": return { icon: <AlertCircle size={15} />, tone: "bg-orange-500/10 text-orange-500" };
      case "ASSIGNED": return { icon: <UserPlus size={15} />, tone: "bg-indigo-500/10 text-indigo-500" };
      case "UNASSIGNED": return { icon: <UserMinus size={15} />, tone: "bg-slate-500/10 text-slate-500" };
      case "CREATED": return { icon: <CheckCircle2 size={15} />, tone: "bg-blue-500/10 text-blue-500" };
      case "REOPENED": return { icon: <RotateCcw size={15} />, tone: "bg-amber-500/10 text-amber-500" };
      default: return { icon: <LayoutTemplate size={15} />, tone: "bg-primary/10 text-primary" };
    }
  };

  const DEPT_LABEL: Record<string, string> = { DEV: "Development", DESIGN: "Design", MARKETING: "Marketing", GENERAL: "General" };
  const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", MANAGER: "Manager", MEMBER: "Member" };
  const roleTone = user.role === "ADMIN" ? "primary" : user.role === "MANAGER" ? "purple" : "neutral";
  const online = !!user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 5 * 60 * 1000;

  const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
  const priorityTone = { URGENT: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-amber-500", LOW: "bg-emerald-500" } as const;
  const priorityTotal = priorityOrder.reduce((n, p) => n + (priorityMap[p] ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-5xl mx-auto animate-fade-in pb-24 space-y-5">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={15} /> All people
      </Link>

      {/* Hero */}
      <Card className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
          <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="xl" />
          {online && <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-surface-elevated" title="Online now" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold text-foreground tracking-tight leading-tight">{user.displayName}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <Badge tone={roleTone}>{ROLE_LABEL[user.role] ?? user.role}</Badge>
            <Badge tone="info">{DEPT_LABEL[user.department] ?? user.department}</Badge>
            {!user.isActive && <Badge tone="danger">Inactive</Badge>}
            <span className="text-[13px] text-muted-foreground">
              {online ? "Online now" : lastActivity ? <>Last active <RelativeTime date={lastActivity.createdAt} /></> : "No activity yet"}
            </span>
          </div>
        </div>
      </Card>

      <StatGroup className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Open workload" value={openTotal} tone="primary" icon={<Folder size={15} />} hint="Tasks across all projects" />
        <StatCard label="Avg. time in progress" value={avgDaysInProgress ?? "—"} tone="success" icon={<Clock size={15} />} hint="Average time to complete" />
        <StatCard label="Member since" value={<span className="text-[20px]">{memberSince}</span>} tone="info" icon={<CalendarIcon size={15} />} hint={`${monthsSince} month${monthsSince === 1 ? "" : "s"} on the team`} />
      </StatGroup>

      {priorityTotal > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Open work by priority</SectionLabel>
            <span className="text-[12px] text-muted-foreground tabular-nums">{priorityTotal} open</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-foreground/[0.06]">
            {priorityOrder.map((p) => (priorityMap[p] ? <div key={p} className={priorityTone[p]} style={{ width: `${(priorityMap[p] / priorityTotal) * 100}%` }} title={`${p}: ${priorityMap[p]}`} /> : null))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {priorityOrder.map((p) => (
              <span key={p} className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${priorityTone[p]}`} />
                {p[0] + p.slice(1).toLowerCase()} <b className="text-foreground tabular-nums">{priorityMap[p] ?? 0}</b>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Activity" description="Contributions over the last 12 months" icon={<Shield size={16} />} />
        <div className="p-5 overflow-x-auto">
          <ActivityHeatmap data={heatmapData} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Recent activity" description="Latest changes made by this person" />
        <div className="p-5">
          {recentActivity.length === 0 ? (
            <EmptyState className="py-8" icon={<MessageSquare size={20} />} title="No activity yet" description="Their ticket updates and comments will appear here." />
          ) : (
            <ul className="space-y-4">
              {recentActivity.map((log) => {
                const style = getActivityIcon(log.action);
                return (
                  <li key={log.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.tone}`}>{style.icon}</span>
                      <div className="min-w-0">
                        <Link href={`/board/${log.ticket.boardId}?ticket=${log.ticket.id}`} className="text-[13.5px] font-semibold text-foreground hover:underline underline-offset-2 decoration-foreground/30 block truncate">
                          {log.ticket.title}
                        </Link>
                        <p className="text-[12.5px] text-muted-foreground truncate">{formatActivityAction(log)}</p>
                      </div>
                    </div>
                    <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                      <RelativeTime date={log.createdAt} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
