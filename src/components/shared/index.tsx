import type { Department, Priority } from "@/lib/prisma-client";

interface DepartmentTagProps {
  department: Department;
  className?: string;
}

const DEPT_CONFIG: Record<Department, { color: string; label: string }> = {
  DEV: { color: "#5B5FEF", label: "Dev" },
  DESIGN: { color: "#EC6A52", label: "Design" },
  MARKETING: { color: "#1EAE7C", label: "Marketing" },
  GENERAL: { color: "hsl(var(--text-secondary))", label: "General" },
};

export function DepartmentTag({ department, className = "" }: DepartmentTagProps) {
  const config = DEPT_CONFIG[department];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-text-secondary ${className}`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}

import { ArrowDown, ArrowUp } from "lucide-react";

interface PriorityChipProps {
  priority: Priority;
  className?: string;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  LOW: { color: "#10B981", bg: "rgba(16, 185, 129, 0.1)", label: "Low", icon: <ArrowDown size={14} /> },
  MEDIUM: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.1)", label: "Medium", icon: <ArrowUp size={14} /> },
  HIGH: { color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)", label: "High", icon: <ArrowUp size={14} /> },
  URGENT: { color: "#B91C1C", bg: "rgba(185, 28, 28, 0.1)", label: "Urgent", icon: <ArrowUp size={14} /> },
};

export function PriorityChip({ priority, className = "" }: PriorityChipProps) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${className}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

interface AvatarProps {
  displayName: string;
  avatarColor: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isOnline?: boolean;
}

export function Avatar({ displayName, avatarColor, size = "md", className = "", isOnline }: AvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-[12px]",
    lg: "w-10 h-10 text-[14px]",
    xl: "w-full h-full text-[32px]",
  };

  return (
    <div className="relative group">
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${sizeClasses[size]} ${className}`}
        style={{ background: avatarColor }}
        title={displayName}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-2 ring-surface-base"></div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  description?: string;
}

export function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <p className="text-text-secondary text-sm">{message}</p>
      {description && <p className="text-muted-foreground text-xs mt-1">{description}</p>}
    </div>
  );
}

interface RelativeTimeProps {
  date: Date | string;
  className?: string;
}

export function RelativeTime({ date, className = "" }: RelativeTimeProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let label: string;
  if (diffSecs < 60) label = "just now";
  else if (diffMins < 60) label = `${diffMins}m ago`;
  else if (diffHours < 24) label = `${diffHours}h ago`;
  else if (diffDays === 1) label = "yesterday";
  else if (diffDays < 7) label = `${diffDays}d ago`;
  else label = d.toLocaleDateString();

  return (
    <time
      dateTime={d.toISOString()}
      className={`font-mono text-xs text-muted-foreground ${className}`}
      title={d.toLocaleString()}
    >
      {label}
    </time>
  );
}

export * from "./Sidebar";
export * from "./TopNav";
export * from "./ThemeToggle";
export * from "./ProjectSwitcher";
export * from "./ChartFilterDropdown";
