"use client";

import { Bell, Calendar, ChevronDown, Upload, KeyRound, LogOut, Settings, User as UserIcon, Loader2, Folder, LayoutDashboard, Users, CheckSquare, Server, Book } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";
import { setOffline } from "@/server/actions/ping";
import { setProjectCookie } from "@/app/(app)/actions";
import type { Project } from "@prisma/client";
import { DeploymentIndicator } from "./DeploymentIndicator";

interface TopNavProps {
  displayName: string;
  avatarColor: string;
  isAdmin: boolean;
  projects: Project[];
  activeProject: Project;
  teamMembersCount?: number;
}

export function TopNav({ displayName, avatarColor, isAdmin, projects, activeProject, teamMembersCount = 0 }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) {
        setProjectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async () => {
    const element = document.getElementById("dashboard-content");
    if (element) {
      // Get the current theme's background color so the PDF doesn't render white text on white bg
      const bgColor = window.getComputedStyle(document.body).backgroundColor;
      
      const originalBg = element.style.backgroundColor;
      const originalPadding = element.style.padding;
      const originalBorderRadius = element.style.borderRadius;
      
      // Temporarily style the element for a beautiful PDF export
      element.style.backgroundColor = bgColor;
      element.style.padding = "20px";
      element.style.borderRadius = "12px";

      const opt = {
        margin:       0.2,
        filename:     'IFlow-Dashboard-Export.pdf',
        image:        { type: 'jpeg' as const, quality: 1.0 },
        html2canvas:  { 
          scale: 3, // High resolution
          useCORS: true, 
          logging: false,
          backgroundColor: bgColor,
          windowWidth: 1400 // Force a desktop layout
        },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' as const }
      };
      
      // Dynamically import to avoid SSR errors
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(opt).from(element).save();
      
      // Restore original styles
      element.style.backgroundColor = originalBg;
      element.style.padding = originalPadding;
      element.style.borderRadius = originalBorderRadius;
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    await setProjectCookie(projectId);
    setProjectOpen(false);
    router.refresh();
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    await setOffline();
    await signOut({ callbackUrl: "/login" });
  };
  
  // Format pathname into title
  let title = "Overview";
  let subtitle = "Here's what's happening with your projects today.";
  let icon = <LayoutDashboard size={22} className="text-primary" />;

  if (pathname?.includes("/board")) {
    title = "Kanban Board";
    subtitle = "Manage and track your tasks seamlessly";
    icon = <Folder size={22} className="text-primary" />;
  } else if (pathname?.includes("/people")) {
    title = "People";
    subtitle = `${teamMembersCount} active team member${teamMembersCount !== 1 ? 's' : ''}`;
    icon = <Users size={22} className="text-primary" />;
  } else if (pathname?.includes("/my-tasks")) {
    title = "My Tasks";
    subtitle = "Your assigned tasks across all boards";
    icon = <CheckSquare size={22} className="text-primary" />;
  } else if (pathname?.includes("/reports")) {
    title = "Reports";
    subtitle = "Team throughput and productivity scores";
  } else if (pathname?.includes("/admin")) {
    title = "Admin";
    subtitle = "Global settings and configuration";
  } else if (pathname?.includes("/github")) {
    title = "GitHub Repository Tracker";
    subtitle = "Track live statistics and recent commits from any public repository.";
  } else if (pathname?.includes("/calendar")) {
    title = "Calendar";
    subtitle = "Manage your team's schedule and deadlines";
  } else if (pathname?.includes("/environments")) {
    title = "Environments";
    subtitle = "Manage secure environment variables and secrets";
    icon = <Server size={22} className="text-primary" />;
  } else if (pathname?.includes("/deployments")) {
    title = "Deployments";
    subtitle = "Live infrastructure status and logs";
    icon = <Server size={22} className="text-primary" />;
  } else if (pathname?.includes("/expenses")) {
    title = "Price Tracker";
    subtitle = "Track team expenses and shared splits";
    icon = <Users size={22} className="text-primary" />;
  } else if (pathname?.includes("/profile")) {
    title = "Profile";
    subtitle = "Manage your account settings";
    icon = <UserIcon size={22} className="text-primary" />;
  } else if (pathname?.includes("/wiki")) {
    title = "Wiki";
    subtitle = "Collaborative knowledge base for your team";
    icon = <Book size={22} className="text-primary" />;
  }

  return (
    <>
      <div className="flex items-center justify-between pl-16 pr-4 py-4 lg:px-8 lg:py-5 border-b border-surface-border bg-surface-base sticky top-0 z-30 transition-colors duration-300">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Date Filter (Static UI for design match) */}
          <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-border bg-surface-elevated text-foreground text-[13px] font-medium hover:border-primary/50 transition-colors">
            <Calendar size={14} className="text-muted-foreground" />
            This Week
            <ChevronDown size={14} className="text-muted-foreground ml-1" />
          </button>

          {/* Export Button */}
          {pathname === "/overview" && (
            <button 
              onClick={handleExport}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-border bg-surface-elevated text-foreground text-[13px] font-medium hover:border-primary/50 transition-colors"
            >
              <Upload size={14} className="text-muted-foreground" />
              Export
            </button>
          )}

          {/* Theme Toggle */}
          <div className="flex items-center rounded-xl border border-surface-border bg-surface-elevated px-1 py-0.5">
             <ThemeToggle />
          </div>

          <DeploymentIndicator />

          {/* Notification Bell */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors">
            <Bell size={16} strokeWidth={2} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-surface-base">
              3
            </span>
          </button>

          {/* Profile Dropdown */}
          <div className="relative ml-2" ref={profileRef}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className="relative focus:outline-none"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shadow-sm ring-2 ring-transparent hover:ring-primary/30 transition-all"
                style={{ background: avatarColor }}
              >
                {initials}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-surface-base"></div>
            </button>

            {profileOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-surface-border flex items-center gap-3 bg-surface-base">
                   <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold shadow-sm flex-shrink-0"
                    style={{ background: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{isAdmin ? 'Admin' : 'Member'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                       <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Online</span>
                    </div>
                  </div>
                </div>
                <div className="p-2 space-y-0.5">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-base rounded-xl transition-colors">
                    <UserIcon size={16} />
                    Profile
                  </Link>
                  <Link href="/change-password" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-base rounded-xl transition-colors">
                    <KeyRound size={16} />
                    Change Password
                  </Link>
                  {/* Settings link removed as requested */}
                  
                  <div className="h-px bg-surface-border mx-2 my-1.5"></div>
                  
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      setLogoutModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <LogOut size={24} />
            </div>
            <h2 className="text-xl font-bold text-center text-foreground mb-2">Are you sure?</h2>
            <p className="text-center text-sm text-muted-foreground mb-6">
              You will be logged out of your account and redirected to the login page.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-surface-base border border-surface-border rounded-xl hover:bg-surface-border transition-colors"
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {isLoggingOut && <Loader2 size={16} className="animate-spin" />}
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
