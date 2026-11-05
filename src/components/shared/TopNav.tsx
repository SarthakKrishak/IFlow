"use client";

import { KeyRound, LogOut, User as UserIcon, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Project } from "@prisma/client";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { DeploymentIndicator } from "./DeploymentIndicator";
import { CommandPalette } from "./CommandPalette";
import { NAV_GROUPS } from "./nav-config";
import { setOffline } from "@/server/actions/ping";
import { Button, Dialog, Kbd } from "@/components/ui";

interface TopNavProps {
  displayName: string;
  avatarColor: string;
  isAdmin: boolean;
  projects: Project[];
  activeProject: Project;
  teamMembersCount?: number;
  boards?: { id: string; name: string }[];
}

const TRACKER_SUBTITLES: Record<string, string> = {
  "/page-tracker/my-work": "Everything you own or need to act on",
  "/page-tracker/reviews": "Submissions waiting for your decision",
  "/page-tracker/workload": "Where open work sits across the team",
};

export function TopNav({ displayName, avatarColor, isAdmin, projects, activeProject, teamMembersCount = 0, boards = [] }: TopNavProps) {
  const pathname = usePathname() ?? "";
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    await setOffline();
    await signOut({ callbackUrl: "/login" });
  };

  // Title + subtitle come from the same config as the sidebar, so they can never disagree.
  const { title, subtitle } = useMemo(() => {
    const flat = NAV_GROUPS.flatMap((g) => g.items);
    const match = flat.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    if (pathname.startsWith("/board")) return { title: "Kanban Board", subtitle: "Manage and track your tasks seamlessly" };
    if (pathname.startsWith("/profile")) return { title: "Profile", subtitle: "Manage your account settings" };
    if (pathname.startsWith("/people")) {
      return { title: "People", subtitle: `${teamMembersCount} active team member${teamMembersCount !== 1 ? "s" : ""}` };
    }
    if (pathname.startsWith("/page-tracker")) {
      return { title: "Page Tracker", subtitle: TRACKER_SUBTITLES[pathname] ?? match?.subtitle ?? "" };
    }
    return { title: match?.label ?? "Overview", subtitle: match?.subtitle ?? "" };
  }, [pathname, teamMembersCount]);

  return (
    <>
      <header className="flex items-center justify-between gap-3 pl-4 pr-2 sm:pr-3 lg:pl-6 lg:pr-4 h-14 shrink-0 pt-[env(safe-area-inset-top)] box-content border-b border-surface-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 sticky top-0 z-30">
        <div className="min-w-0 flex items-center gap-2.5">
          <img src="/logo-large.png" alt="" className="lg:hidden h-6 w-auto shrink-0" />
          <h1 className="text-[15px] font-semibold text-foreground tracking-[-0.01em] truncate">{title}</h1>
          {subtitle && <p className="text-[12.5px] text-muted-foreground truncate hidden xl:block self-end pb-px">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1">
          {/* Command palette trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 h-8 pl-2.5 pr-1.5 w-60 mr-2 rounded-lg border border-surface-border bg-surface-base text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
            aria-label="Open command palette"
          >
            <Search size={14} />
            <span className="text-[13px] flex-1 text-left">Search or jump to…</span>
            <Kbd>{isMac ? "⌘" : "Ctrl"} K</Kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            aria-label="Search"
          >
            <Search size={15} />
          </button>

          <ThemeToggle />

          <span className="hidden md:contents">
            <DeploymentIndicator />
          </span>
          <NotificationBell />

          {/* Profile */}
          <div className="relative ml-1.5" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="relative rounded-full focus-visible:outline-none focus-visible:shadow-ring"
              aria-label="Account menu"
              aria-expanded={profileOpen}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold ring-2 ring-transparent hover:ring-foreground/15 transition-shadow"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <span className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
            </button>

            {profileOpen && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-popover rounded-xl shadow-pop overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-3 border-b border-surface-border flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                    style={{ background: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{isAdmin ? "Admin" : "Member"}</p>
                  </div>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-2 h-8 text-[13px] text-foreground/85 hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                  >
                    <UserIcon size={15} /> Profile
                  </Link>
                  <Link
                    href="/change-password"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-2 h-8 text-[13px] text-foreground/85 hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                  >
                    <KeyRound size={15} /> Change password
                  </Link>
                  <div className="h-px bg-surface-border mx-1 my-1" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setLogoutModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-2 h-8 text-[13px] text-foreground/85 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors text-left"
                  >
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        isAdmin={isAdmin}
        boards={boards}
        projects={projects}
        activeProjectId={activeProject.id}
      />

      {logoutModalOpen && (
        <Dialog
          size="sm"
          title="Log out of IFlow?"
          description="You’ll be redirected to the login page."
          onClose={() => !isLoggingOut && setLogoutModalOpen(false)}
          footer={
            <>
              <Button onClick={() => setLogoutModalOpen(false)} disabled={isLoggingOut}>
                Cancel
              </Button>
              <Button variant="primary" className="!bg-red-600 !text-white" loading={isLoggingOut} onClick={handleLogoutConfirm}>
                {isLoggingOut ? "Logging out…" : "Log out"}
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground leading-relaxed">Any unsaved changes in open panels will be lost.</p>
        </Dialog>
      )}
    </>
  );
}
