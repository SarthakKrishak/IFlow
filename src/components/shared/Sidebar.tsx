"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  BarChart2,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  Plus,
  Home,
  SlidersHorizontal,
  Code2,
  PenTool,
  Megaphone,
  ChevronsLeft,
  Kanban,
  Github,
  Calendar,
  Trash2,
  Server,
  Banknote
} from "lucide-react";
import { useState } from "react";
import type { Board, Project, User } from "@prisma/client";
import { CreateBoardModal } from "../board/CreateBoardModal";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { deleteBoard } from "@/server/actions/board.actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/overview", icon: Home },
  { label: "My Tasks", href: "/my-tasks", icon: SlidersHorizontal, badge: 12 },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "People", href: "/people", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "Project Expenses", href: "/expenses", icon: Banknote },
  { label: "GitHub Tracker", href: "/github", icon: Github },
  { label: "Environments", href: "/environments", icon: Server },
  { label: "Admin", href: "/admin", icon: Settings, adminOnly: true },
];

const PROJECT_COLORS = ["bg-indigo-600", "bg-blue-600", "bg-rose-500", "bg-orange-500", "bg-emerald-500"];

interface SidebarProps {
  isAdmin: boolean;
  isManager?: boolean;
  projects: Project[];
  activeProject: Project;
  boards: Pick<Board, "id" | "name" | "slug">[];
  users: Pick<User, "id" | "displayName">[];
  myTasksCount?: number;
}

export function Sidebar({ isAdmin, isManager, projects, activeProject, boards, users, myTasksCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this board? This action cannot be undone.")) return;
    setIsDeleting(boardId);
    const res = await deleteBoard(boardId);
    if (res.success) {
      if (pathname === `/board/${boardId}`) {
        router.push("/overview");
      } else {
        router.refresh();
      }
    } else {
      alert(res.error);
    }
    setIsDeleting(null);
  };

  const navItems = NAV_ITEMS.map(item => {
    if (item.label === "My Tasks" && myTasksCount !== undefined) {
      return { ...item, badge: myTasksCount };
    }
    return item;
  });

  // Fallback icons for boards if we want to match the design roughly based on name
  const getBoardIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("dev")) return Code2;
    if (lower.includes("design")) return PenTool;
    if (lower.includes("marketing") || lower.includes("launch")) return Megaphone;
    return Kanban;
  };

  const SidebarContent = (
    <nav className="flex flex-col h-full bg-surface-base border-r border-surface-border transition-all duration-300" aria-label="Main navigation">
      {/* Header / Logo */}
      <div className={`flex items-center py-5 ${collapsed ? 'px-4 justify-center' : 'px-6 justify-between'}`}>
        {!collapsed ? (
          <>
            <Link href="/overview" className="flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <img
                  src="/logo-large.png"
                  alt="IFlow Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: bold; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);">IF</div>';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[17px] font-bold text-foreground tracking-tight leading-tight">IFlow</span>
                <span className="text-[11px] text-muted-foreground font-medium tracking-wide leading-tight">By Imaginum</span>
              </div>
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground hidden lg:block transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Link href="/overview">
              <div className="relative w-8 h-8 flex-shrink-0">
                <img
                    src="/logo-large.png"
                  alt="IFlow Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
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
              <Menu size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 custom-scrollbar">
        
        {/* Workspace Section */}
        <div className="mb-6">
          {!collapsed && <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 ml-2">Workspace</p>}
          
          <div className="-mx-1">
             <ProjectSwitcher projects={projects} activeProject={activeProject} collapsed={collapsed} isAdmin={isAdmin} />
          </div>
        </div>

        {/* Main Nav Items */}
        <div className="space-y-1 mb-8">
          {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all group ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  {!collapsed && <span>{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-primary-foreground/20 text-white' : 'bg-surface-elevated border border-surface-border text-foreground'}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Boards List */}
        <div className="mb-4">
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Boards
              </p>
              {(isAdmin || isManager) && (
                <button 
                  onClick={() => setIsCreatingBoard(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Create new board"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          )}
          <div className="space-y-1">
            {boards.map((board) => {
              const isActive = pathname === `/board/${board.id}`;
              const BoardIcon = getBoardIcon(board.name);
              return (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? board.name : undefined}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <BoardIcon size={16} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && <span className="truncate">{board.name}</span>}
                  </div>
                  {!collapsed && isAdmin && (
                    <button
                      onClick={(e) => handleDeleteBoard(e, board.id)}
                      disabled={isDeleting === board.id}
                      className={`transition-all ${isDeleting === board.id ? 'opacity-100 animate-pulse text-[#D1495B]' : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#D1495B]'}`}
                      title="Delete board"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {isCreatingBoard && (
          <CreateBoardModal
            projectId={activeProject.id}
            users={users}
            onClose={() => setIsCreatingBoard(false)}
          />
        )}
      </div>

      {/* Bottom Collapse Button */}
      {!collapsed && (
        <div className="p-4 mt-auto flex items-center justify-between border-t border-surface-border">
          <button 
            onClick={() => setCollapsed(true)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface-elevated"
            title="Collapse Sidebar"
          >
            <ChevronsLeft size={20} />
          </button>
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mr-2 select-none">V2.0</span>
        </div>
      )}
    </nav>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-surface-elevated border border-surface-border text-foreground shadow-sm"
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
        className={`lg:hidden fixed top-0 left-0 h-full z-50 bg-surface-base transition-transform duration-300 ease-out shadow-2xl w-[260px] ${
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

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
  );
}
