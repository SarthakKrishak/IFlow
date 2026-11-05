"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Home, Layers, Menu, Video } from "lucide-react";
import { cn } from "@/lib/utils";

/** Event the sidebar listens for to open its mobile drawer ("More"). */
export const OPEN_NAV_EVENT = "iflow:open-nav";

const TABS = [
  { href: "/overview", label: "Home", icon: Home },
  { href: "/my-tasks", label: "Tasks", icon: CheckSquare },
  { href: "/page-tracker", label: "Tracker", icon: Layers },
  { href: "/meetings", label: "Meetings", icon: Video },
] as const;

/**
 * App-style bottom navigation for phones and small tablets (hidden from lg).
 * Respects the iOS home-indicator safe area.
 */
export function MobileTabBar({ myTasksCount = 0, pendingReviews = 0 }: { myTasksCount?: number; pendingReviews?: number }) {
  const pathname = usePathname() ?? "";
  const badge: Record<string, number> = { "/my-tasks": myTasksCount, "/page-tracker": pendingReviews };

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 h-14">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const n = badge[href] ?? 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative h-full flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors active:scale-95",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon size={21} strokeWidth={active ? 2.1 : 1.7} />
                  {n > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9.5px] font-semibold flex items-center justify-center tabular-nums ring-2 ring-background">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_NAV_EVENT))}
            className="h-full w-full flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-muted-foreground active:scale-95 transition-transform"
            aria-label="Open full menu"
          >
            <Menu size={21} strokeWidth={1.7} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
