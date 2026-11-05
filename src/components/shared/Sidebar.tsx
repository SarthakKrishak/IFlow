"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, PanelLeftClose, PanelLeftOpen, Plus, Code2, PenTool, Megaphone, Kanban, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { OPEN_NAV_EVENT } from "./MobileTabBar";
import type { Board, Project, User } from "@prisma/client";
import { CreateBoardModal } from "../board/CreateBoardModal";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { deleteBoard } from "@/server/actions/board.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui";
import { NAV_GROUPS, type NavItem } from "./nav-config";

interface SidebarProps {
  isAdmin: boolean;
  isManager?: boolean;
  projects: Project[];
  activeProject: Project;
  boards: Pick<Board, "id" | "name" | "slug">[];
  users: Pick<User, "id" | "displayName">[];
  myTasksCount?: number;
  /** Page Tracker submissions waiting for the current user's review. */
  pendingReviews?: number;
}

function getBoardIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("dev")) return Code2;
  if (lower.includes("design")) return PenTool;
  if (lower.includes("marketing") || lower.includes("launch")) return Megaphone;
  return Kanban;
}

export function Sidebar({ isAdmin, isManager, projects, activeProject, boards, users, myTasksCount, pendingReviews }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { confirm: ask, dialog: confirmDialog } = useConfirm();

  // Mobile drawer is opened from the bottom tab bar's "More" button.
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(OPEN_NAV_EVENT, open);
    return () => window.removeEventListener(OPEN_NAV_EVENT, open);
  }, []);
  // Close the drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);
  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.preventDefault();
    if (!(await ask({ title: "Delete this board?", description: "All of its columns and tickets will be permanently removed.", confirmLabel: "Delete board", danger: true }))) return;
    setIsDeleting(boardId);
    try {
      const res = await deleteBoard(boardId);
      if (res.success) {
        toast.success("Board deleted");
        if (pathname === `/board/${boardId}`) {
          router.push("/overview");
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.error || "Failed to delete board");
      }
    } catch (error) {
      console.error("Delete board failed:", error);
      toast.error("Network error — couldn't delete board");
    }
    setIsDeleting(null);
  };

  const badgeFor = (item: NavItem): number | undefined => {
    if (item.label === "My Tasks") return myTasksCount || undefined;
    if (item.label === "Page Tracker") return pendingReviews || undefined;
    return item.badge;
  };

  const SidebarContent = (
    <nav className="flex flex-col h-full bg-surface-base" aria-label="Main navigation">
      {/* Header — same height as the top bar so the chrome lines up */}
      <div className={cn("h-14 shrink-0 flex items-center", collapsed ? "px-3 justify-center" : "pl-4 pr-2.5 justify-between")}>
        {!collapsed ? (
          <>
            <Link href="/overview" className="flex items-center gap-2 min-w-0">
              <div className="relative w-5 h-6 flex-shrink-0">
                <img
                  src="/logo-large.png"
                  alt="IFlow Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement!.innerHTML =
                      '<div style="width:100%;height:100%;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;background:hsl(var(--primary))">IF</div>';
                  }}
                />
              </div>
              <span className="text-[14.5px] font-semibold text-foreground tracking-[-0.01em]">IFlow</span>
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-3 custom-scrollbar">
        {/* Workspace */}
        <div className="mb-3">
          <ProjectSwitcher projects={projects} activeProject={activeProject} collapsed={collapsed} isAdmin={isAdmin} />
        </div>

        {/* Grouped navigation */}
        <div className="space-y-5 mb-5">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((i) => !i.adminOnly || isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={group.label ?? "main"}>
                {group.label &&
                  (collapsed ? (
                    <div className="h-px bg-surface-border mx-2 mb-2" />
                  ) : (
                    <p className="px-2 mb-1 text-[11.5px] font-medium text-muted-foreground/80">{group.label}</p>
                  ))}
                <div className="space-y-px">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
                    const badge = badgeFor(item);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "relative flex items-center justify-between h-10 lg:h-8 px-2 rounded-md text-[14px] lg:text-[13px] transition-colors group",
                          isActive
                            ? "bg-surface-hover text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--surface-border))]"
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/70",
                          collapsed && "justify-center px-0"
                        )}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon size={16} className={cn("flex-shrink-0", isActive && "text-foreground")} strokeWidth={1.75} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!collapsed && badge ? (
                          <span className="min-w-5 h-[18px] px-1 inline-flex items-center justify-center text-[11px] font-medium rounded tabular-nums text-muted-foreground">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Boards */}
        <div className="mb-4">
          {!collapsed ? (
            <div className="flex items-center justify-between pl-2 pr-1 mb-1">
              <p className="text-[11.5px] font-medium text-muted-foreground/80">Boards</p>
              {(isAdmin || isManager) && (
                <button
                  onClick={() => setIsCreatingBoard(true)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                  title="Create new board"
                  aria-label="Create new board"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="h-px bg-surface-border mx-2 mb-2" />
          )}
          <div className="space-y-px">
            {boards.map((board) => {
              const isActive = pathname === `/board/${board.id}`;
              const BoardIcon = getBoardIcon(board.name);
              return (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group relative flex items-center justify-between h-10 lg:h-8 px-2 rounded-md text-[14px] lg:text-[13px] transition-colors",
                    isActive
                      ? "bg-surface-hover text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--surface-border))]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/70",
                    collapsed && "justify-center px-0"
                  )}
                  title={collapsed ? board.name : undefined}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <BoardIcon size={15} className="flex-shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="truncate">{board.name}</span>}
                  </div>
                  {!collapsed && isAdmin && (
                    <button
                      onClick={(e) => handleDeleteBoard(e, board.id)}
                      disabled={isDeleting === board.id}
                      className={cn(
                        "transition-opacity",
                        isDeleting === board.id
                          ? "opacity-100 animate-pulse text-red-500"
                          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                      )}
                      title="Delete board"
                      aria-label={`Delete board ${board.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </Link>
              );
            })}
            {boards.length === 0 && !collapsed && <p className="px-2 py-1.5 text-[12px] text-muted-foreground/70">No boards yet</p>}
          </div>
        </div>

        {confirmDialog}
        {isCreatingBoard && (
          <CreateBoardModal projectId={activeProject.id} users={users} onClose={() => setIsCreatingBoard(false)} />
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 h-11 shrink-0 flex items-center justify-between">
          <a
            href="https://imaginumorg.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Visit Imaginum"
          >
            <img src="/imaginum_logo.png" alt="Imaginum" className="h-4 w-4 rounded-full object-cover opacity-80" />
            <span className="text-[12px]">Imaginum</span>
          </a>
          <span className="text-[11px] font-mono text-muted-foreground/50 select-none">v3.0</span>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200" onClick={() => setMobileOpen(false)} />
      )}

      <div
        className={cn(
          "lg:hidden fixed top-0 left-0 h-[100dvh] z-50 bg-surface-base transition-transform duration-300 ease-out shadow-2xl w-[min(300px,86vw)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!mobileOpen}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3.5 right-3 z-10 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        {SidebarContent}
      </div>

      <aside className={cn("hidden lg:flex flex-col h-full flex-shrink-0 transition-[width] duration-300", collapsed ? "w-[60px]" : "w-[240px]")}>
        {SidebarContent}
      </aside>
    </>
  );
}
