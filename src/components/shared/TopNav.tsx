"use client";

import { Search, Bell, HelpCircle, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

export function TopNav() {
  const pathname = usePathname();
  
  // Format pathname into title
  let title = "Dashboard";
  if (pathname.includes("/reports")) title = "Reports";
  if (pathname.includes("/people")) title = "Team";
  if (pathname.includes("/admin")) title = "Settings";
  if (pathname.includes("/board")) title = "Board";

  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-surface-border bg-surface-elevated sticky top-0 z-30 transition-colors duration-300">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {title === "Dashboard" && (
          <p className="text-[14px] text-muted-foreground mt-1 font-medium">Welcome back! Here's what's happening with your projects.</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-surface-border/50">
            <Bell size={20} strokeWidth={2} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-surface-elevated"></span>
          </button>
        </div>
      </div>
    </div>
  );
}
