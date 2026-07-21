"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  ChevronLeft,
  KeyRound,
  Kanban,
  MoreVertical,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Board, Project, User } from "@prisma/client";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { CreateBoardModal } from "../board/CreateBoardModal";
import { Plus } from "lucide-react";
import { setOffline } from "@/server/actions/ping";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", href: "/my-tasks", icon: Kanban },
  { label: "People", href: "/people", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "Admin", href: "/admin", icon: Settings, adminOnly: true },
];

interface SidebarProps {
  isAdmin: boolean;
  isManager?: boolean;
  projects: Project[];
  activeProject: Project;
  boards: Pick<Board, "id" | "name" | "slug">[];
  users: Pick<User, "id" | "displayName">[];
  displayName: string;
  avatarColor: string;
}

export function Sidebar({ isAdmin, isManager, projects, activeProject, boards, users, displayName, avatarColor }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const SidebarContent = (
    <nav className="flex flex-col h-full bg-surface-elevated border-r border-surface-border transition-all duration-300" aria-label="Main navigation">
      {/* Logo */}
      <div className={`flex items-center py-5 ${collapsed ? 'px-4 justify-center' : 'px-6 gap-3 justify-between'}`}>
        {!collapsed ? (
          <>
            <Link href="/overview" className="flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <img
                  src="/logo.png"
                  alt="IFlow Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: bold; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);">IF</div>';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-foreground tracking-tight leading-tight">IFlow</span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider leading-tight">By Imaginum</span>
              </div>
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground hidden lg:block"
            >
              <ChevronLeft size={20} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Link href="/dashboard">
              <div className="relative w-8 h-8 flex-shrink-0">
                <img
                  src="/logo.png"
                  alt="IFlow Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback if logo not found
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: bold; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);">IF</div>';
                  }}
                />
              </div>
            </Link>
            <button
              onClick={() => setCollapsed(false)}
              className="text-muted-foreground hover:text-foreground hidden lg:block"
            >
              <Menu size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-surface-border mx-4 mb-3" />

      {/* Global Nav */}
      <div className="px-3 pb-3">
        <Link
          href="/overview"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center px-3 py-2.5 rounded-3xl text-[14px] font-medium transition-all group ${
            pathname === "/overview"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-border/50"
          } ${collapsed ? "justify-center" : "gap-3"}`}
          title={collapsed ? "Global Overview" : undefined}
        >
          <Globe size={18} className="flex-shrink-0" strokeWidth={pathname === "/overview" ? 2.5 : 2} />
          {!collapsed && <span>Overview</span>}
        </Link>
      </div>

      <div className="h-px bg-surface-border mx-4 mb-3" />

      {/* Project Switcher */}
      <div className={collapsed ? "px-2" : "px-4"}>
        <ProjectSwitcher projects={projects} activeProject={activeProject} collapsed={collapsed} isAdmin={isAdmin} />
      </div>

      <div className="h-px bg-surface-border mx-4 my-3" />

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-3xl text-[14px] font-medium transition-all group ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-border/50"
              } ${collapsed ? "justify-center" : "gap-3"}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Boards List */}
        <div className="pt-4">
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Boards
              </p>
              {(isAdmin || isManager) && (
                <button 
                  onClick={() => setIsCreatingBoard(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Create new board"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          )}
            {boards.map((board) => {
              const isActive = pathname === `/board/${board.id}`;
              return (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-3xl text-[14px] font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-border/50"
                  } ${collapsed ? "justify-center" : "gap-3"}`}
                  title={collapsed ? board.name : undefined}
                >
                  <Kanban size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  {!collapsed && <span className="truncate">{board.name}</span>}
                </Link>
              );
            })}
          </div>

        {isCreatingBoard && (
          <CreateBoardModal
            projectId={activeProject.id}
            users={users}
            onClose={() => setIsCreatingBoard(false)}
          />
        )}
      </div>

      {/* User profile dropdown area */}
      <div className="p-4 relative" ref={profileMenuRef}>
        {profileMenuOpen && (
          <div className="absolute bottom-full left-4 mb-2 w-56 bg-surface-base border border-surface-border rounded-3xl shadow-lg overflow-hidden flex flex-col z-50">
            <div className="px-4 py-3 border-b border-surface-border">
              <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{isAdmin ? 'Admin' : 'Member'}</p>
            </div>
            <div className="p-1">
              <Link href="/change-password" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated rounded-2xl transition-colors">
                <KeyRound size={16} />
                Change Password
              </Link>
              <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-surface-elevated rounded-2xl transition-colors">
                <span className="flex items-center gap-2"><ThemeToggle /></span>
              </div>
              <button 
                onClick={async () => {
                  await setOffline();
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-2xl transition-colors text-left"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        )}

        <div 
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={`flex items-center cursor-pointer hover:bg-surface-border/50 p-2 rounded-3xl transition-colors ${collapsed ? 'justify-center' : 'gap-3'}`}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm"
            style={{ background: avatarColor }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-[12px] text-muted-foreground truncate">{isAdmin ? 'Admin' : 'Member'}</p>
              </div>
              <MoreVertical size={16} className="text-muted-foreground" />
            </>
          )}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-2xl bg-surface-elevated border border-surface-border text-foreground shadow-sm"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`lg:hidden fixed top-0 left-0 h-full z-50 bg-surface-elevated transition-transform duration-300 ease-out shadow-2xl w-[260px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
        {SidebarContent}
      </div>

      <aside className={`hidden lg:flex flex-col h-full flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-[80px]' : 'w-[260px]'}`}>
        {SidebarContent}
      </aside>
    </>
  );
}
