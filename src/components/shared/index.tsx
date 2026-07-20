import type { Department, Priority } from "@prisma/client";

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

interface PriorityChipProps {
  priority: Priority;
  className?: string;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  LOW: { color: "hsl(var(--muted-foreground))", label: "Low" },
  MEDIUM: { color: "#C79A3D", label: "Medium" },
  HIGH: { color: "#D9713C", label: "High" },
  URGENT: { color: "#D1495B", label: "Urgent" },
};

export function PriorityChip({ priority, className = "" }: PriorityChipProps) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}
      style={{
        color: config.color,
        background: `${config.color}18`,
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.label}
    </span>
  );
}

interface AvatarProps {
  displayName: string;
  avatarColor: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ displayName, avatarColor, size = "md", className = "" }: AvatarProps) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ background: avatarColor }}
      title={displayName}
      aria-label={displayName}
    >
      {initials}
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

export { Sidebar } from "./Sidebar";
export { ThemeProvider } from "./ThemeProvider";
export { ThemeToggle } from "./ThemeToggle";
export { ProjectSwitcher } from "./ProjectSwitcher";
