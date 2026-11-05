"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Folder, Kanban, Search } from "lucide-react";
import type { Project } from "@prisma/client";
import { setProjectCookie } from "@/app/(app)/actions";
import { NAV_GROUPS, PALETTE_EXTRAS } from "./nav-config";
import { Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  group: "Go to" | "Boards" | "Projects";
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

/** ⌘K / Ctrl+K — jump to any page, board or project without leaving the keyboard. */
export function CommandPalette({
  open,
  onClose,
  isAdmin,
  boards,
  projects,
  activeProjectId,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  boards: { id: string; name: string }[];
  projects: Project[];
  activeProjectId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const nav: Command[] = [
      ...NAV_GROUPS.flatMap((g) => g.items)
        .filter((i) => !i.adminOnly || isAdmin)
        .map((i) => ({ id: `nav:${i.href}`, group: "Go to" as const, label: i.label, icon: i.icon, run: go(i.href) })),
      ...PALETTE_EXTRAS.map((i) => ({ id: `nav:${i.href}`, group: "Go to" as const, label: i.label, icon: i.icon, run: go(i.href) })),
    ];
    const brd: Command[] = boards.map((b) => ({
      id: `board:${b.id}`,
      group: "Boards",
      label: b.name,
      icon: Kanban,
      run: go(`/board/${b.id}`),
    }));
    const prj: Command[] = projects
      .filter((p) => p.id !== activeProjectId)
      .map((p) => ({
        id: `project:${p.id}`,
        group: "Projects",
        label: `Switch to ${p.name}`,
        icon: Folder,
        run: async () => {
          onClose();
          await setProjectCookie(p.id);
          router.refresh();
        },
      }));
    return [...nav, ...brd, ...prj];
  }, [boards, projects, activeProjectId, isAdmin, router, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[index]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center pt-[12vh] px-4 animate-in fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl bg-surface-elevated border border-surface-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-surface-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, boards and projects…"
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/70 outline-none"
            aria-label="Search"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">No results for “{query}”</p>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              const Icon = c.icon;
              return (
                <div key={c.id}>
                  {header && (
                    <p className="px-3 pt-2 pb-1 text-[12px] font-medium tracking-[0.08em] text-muted-foreground/70">{header}</p>
                  )}
                  <button
                    data-idx={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => c.run()}
                    className={cn(
                      "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] text-left transition-colors",
                      i === index ? "bg-surface-hover text-foreground" : "text-foreground/90"
                    )}
                  >
                    <Icon size={16} className={cn("shrink-0", i === index ? "text-primary" : "text-muted-foreground")} />
                    <span className="flex-1 truncate">{c.label}</span>
                    {i === index && <CornerDownLeft size={13} className="shrink-0 opacity-70" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between px-4 h-9 border-t border-surface-border bg-surface-base/60 text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}
