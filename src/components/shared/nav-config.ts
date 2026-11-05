import {
  Users,
  BarChart2,
  Settings,
  Home,
  CheckSquare,
  Github,
  Calendar,
  Server,
  Rocket,
  Banknote,
  BookOpen,
  Layers,
  ClipboardCheck,
  Gauge,
  User,
  Video,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  badge?: number;
  /** Page title + subtitle shown in the top bar for this route. */
  subtitle?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

// Single source of truth for the sidebar, the top-bar title and the command palette.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Overview", href: "/overview", icon: Home, subtitle: "Here’s what’s happening across your projects" },
      { label: "My Tasks", href: "/my-tasks", icon: CheckSquare, subtitle: "Your assigned tasks across all boards" },
      { label: "Page Tracker", href: "/page-tracker", icon: Layers, subtitle: "Design, development and testing — with an owner on every item" },
      { label: "Calendar", href: "/calendar", icon: Calendar, subtitle: "Your team’s schedule and deadlines" },
      { label: "Meetings", href: "/meetings", icon: Video, subtitle: "Schedule Google Meet calls — one-time or recurring" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "People", href: "/people", icon: Users, subtitle: "Your team members" },
      { label: "Reports", href: "/reports", icon: BarChart2, subtitle: "Team throughput and productivity" },
      { label: "Project Expenses", href: "/expenses", icon: Banknote, subtitle: "Track expenses and shared splits" },
    ],
  },
  {
    label: "Knowledge",
    items: [{ label: "Wiki", href: "/wiki", icon: BookOpen, subtitle: "Collaborative knowledge base for your team" }],
  },
  {
    label: "Engineering",
    items: [
      { label: "GitHub Tracker", href: "/github", icon: Github, subtitle: "Live statistics and commits from any public repository" },
      { label: "Environments", href: "/environments", icon: Server, subtitle: "Secure environment variables and secrets" },
      { label: "Deployments", href: "/deployments", icon: Rocket, subtitle: "Live infrastructure status and logs" },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Admin", href: "/admin", icon: Settings, adminOnly: true, subtitle: "Global settings and configuration" }],
  },
];

/** Deep links only the command palette offers (not shown in the sidebar). */
export const PALETTE_EXTRAS: NavItem[] = [
  { label: "Page Tracker · My Work", href: "/page-tracker/my-work", icon: User },
  { label: "Page Tracker · Reviews", href: "/page-tracker/reviews", icon: ClipboardCheck },
  { label: "Page Tracker · Team workload", href: "/page-tracker/workload", icon: Gauge },
  { label: "Profile", href: "/profile", icon: User },
];
