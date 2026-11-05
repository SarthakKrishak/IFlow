"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, User, ClipboardCheck, Gauge } from "lucide-react";

export function TrackerTabs({ isLead, pendingReviews }: { isLead: boolean; pendingReviews: number }) {
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: "/page-tracker", label: "Pages", icon: Layers, exact: false },
    { href: "/page-tracker/my-work", label: "My Work", icon: User, exact: true },
    { href: "/page-tracker/reviews", label: "Reviews", icon: ClipboardCheck, exact: true, badge: pendingReviews },
    ...(isLead ? [{ href: "/page-tracker/workload", label: "Workload", icon: Gauge, exact: true }] : []),
  ];
  const isActive = (t: (typeof tabs)[number]) =>
    t.href === "/page-tracker"
      ? pathname === "/page-tracker" || !["/page-tracker/my-work", "/page-tracker/reviews", "/page-tracker/workload"].includes(pathname)
      : pathname === t.href;

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-3 shrink-0">
      <div className="flex items-center gap-4 border-b border-surface-border overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-1.5 h-10 text-[13px] font-medium border-b-[1.5px] -mb-px whitespace-nowrap transition-colors ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} className={active ? "" : "opacity-70"} />
              {t.label}
              {"badge" in t && t.badge ? (
                <span className="min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10.5px] font-semibold rounded-full bg-primary text-primary-foreground tabular-nums">
                  {t.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
