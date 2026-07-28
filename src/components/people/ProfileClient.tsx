"use client";

import Link from "next/link";
import { ArrowLeft, Folder, Clock, Calendar as CalendarIcon, Shield, ChevronDown, MessageSquare, LayoutTemplate, PenLine, Plus, AlertCircle, ArrowUp, ArrowDown, UserPlus, UserMinus, Tag, CheckCircle2, RotateCcw } from "lucide-react";
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
      case "COMMENTED": return { icon: <MessageSquare size={16} />, bg: "bg-[#8B8FF5]/10", border: "border-[#8B8FF5]/20", text: "text-[#8B8FF5]" };
      case "LABEL_ADDED": return { icon: <Tag size={16} />, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-500" };
      case "DUE_DATE_CHANGED": return { icon: <PenLine size={16} />, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500" };
      case "PRIORITY_CHANGED": return { icon: <AlertCircle size={16} />, bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-500" };
      case "ASSIGNED": return { icon: <UserPlus size={16} />, bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-500" };
      case "CREATED": return { icon: <CheckCircle2 size={16} />, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500" };
      default: return { icon: <MessageSquare size={16} />, bg: "bg-[#8B8FF5]/10", border: "border-[#8B8FF5]/20", text: "text-[#8B8FF5]" };
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto animate-fade-in pb-24">
      {/* Back Link */}
      <Link href="/people" className="inline-flex items-center gap-2 text-[13px] font-bold text-primary hover:text-primary/80 transition-colors mb-8">
        <ArrowLeft size={16} />
        Back to people
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
        <div className="relative flex-shrink-0" style={{ width: "96px", height: "96px" }}>
          <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="xl" />
          {user.lastSeenAt && (Date.now() - new Date(user.lastSeenAt).getTime() < 5 * 60 * 1000) && (
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-surface-base z-10"></div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{user.displayName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[12px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-bold tracking-wide">
              {user.department === "engineering" ? "Dev" : user.department === "design" ? "Designer" : "Member"}
            </span>
            {lastActivity && (
              <span className="text-[13px] text-muted-foreground font-medium">
                Last active <RelativeTime date={lastActivity.createdAt} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* Open Workload */}
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center border flex-shrink-0 bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
              <Folder size={18} />
            </div>
            <div>
              <p className="text-[12px] font-bold text-muted-foreground tracking-wider mb-1">Open Workload</p>
              <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{openTotal}</p>
              <p className="text-[12px] font-medium text-muted-foreground mt-1">Across all projects</p>
            </div>
          </div>
        </div>

        {/* Time in Progress */}
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border flex-shrink-0 bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground tracking-wider mb-1">Time in Progress</p>
            <p className="text-2xl font-bold font-mono tracking-tight text-foreground">{avgDaysInProgress ?? "—"}</p>
            <p className="text-[12px] font-medium text-muted-foreground mt-1">Average time to complete</p>
          </div>
        </div>

        {/* Member Since */}
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border flex-shrink-0 bg-blue-500/10 border-blue-500/20 text-blue-400">
            <CalendarIcon size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground tracking-wider mb-1">Member Since</p>
            <p className="text-xl font-bold font-mono tracking-tight text-foreground">{memberSince}</p>
            <p className="text-[12px] font-medium text-muted-foreground mt-2">{monthsSince} months</p>
          </div>
        </div>

        {/* Role & Permissions */}
        <div className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center border flex-shrink-0 bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground tracking-wider mb-1">Role & Permissions</p>
            <div className="inline-flex mt-1">
              <span className="text-[13px] px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold">
                {user.role === "ADMIN" ? "Admin" : "Developer"}
              </span>
            </div>
            <p className="text-[12px] font-medium text-muted-foreground mt-3">Full access to assigned projects</p>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-3xl p-6 mb-8 bg-surface-elevated border border-surface-border shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-[15px] font-bold text-foreground tracking-tight">Activity — last 12 months</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-border bg-surface-base text-foreground text-[12px] font-bold hover:border-primary/50 transition-colors">
            Last 12 months
            <ChevronDown size={14} className="text-muted-foreground ml-1" />
          </button>
        </div>
        <ActivityHeatmap data={heatmapData} />
      </div>

      {/* Recent Activity */}
      <div className="rounded-3xl border border-surface-border shadow-sm overflow-hidden flex flex-col bg-surface-elevated">
        <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-foreground tracking-tight">Recent activity</h2>
          <button className="text-[13px] font-bold text-primary hover:text-primary/80 transition-colors">
            View all
          </button>
        </div>
        <div className="p-6">
          {recentActivity.length === 0 ? (
            <p className="text-[14px] font-medium text-muted-foreground text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((log) => {
                const style = getActivityIcon(log.action);
                return (
                  <div key={log.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.bg} ${style.border} ${style.text}`}>
                        {style.icon}
                      </div>
                      <div>
                        <Link
                          href={`/board/${log.ticket.boardId}`}
                          className="text-[14px] font-bold text-foreground hover:text-primary transition-colors block mb-0.5"
                        >
                          {log.ticket.title}
                        </Link>
                        <p className="text-[13px] font-medium text-muted-foreground">
                          {formatActivityAction(log)}
                        </p>
                      </div>
                    </div>
                    <div className="text-[13px] font-bold text-muted-foreground">
                      <RelativeTime date={log.createdAt} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
