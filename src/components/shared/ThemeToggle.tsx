"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Waves, Crown, Zap, CircleDot, Palette, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const THEMES = [
  { id: "light", name: "Light", icon: Sun, dot: "#4B4FD6", blurb: "Paper and ink" },
  { id: "dark", name: "Dark", icon: Moon, dot: "#7B7EF0", blurb: "Graphite" },
  { id: "ocean", name: "Night Owl", icon: Waves, dot: "#00E5FF", blurb: "Deep navy" },
  { id: "dracula", name: "Dracula", icon: Crown, dot: "#BD93F9", blurb: "Plum pop" },
  { id: "monokai", name: "Monokai", icon: Zap, dot: "#FFD866", blurb: "Warm amber" },
  { id: "onedark", name: "One Dark", icon: CircleDot, dot: "#61AFEF", blurb: "Atom slate" },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-8 flex items-center justify-center text-muted-foreground" aria-hidden="true">
        <Palette size={16} strokeWidth={1.75} />
      </div>
    );
  }

  // Graceful fallback: legacy stored values (forest/sunset) map to new palette.
  // Prefer resolvedTheme so system/default choices render the right icon.
  const legacyMap: Record<string, string> = { forest: "dracula", sunset: "monokai" };
  const effectiveId = legacyMap[theme ?? ""] ?? theme ?? legacyMap[resolvedTheme ?? ""] ?? resolvedTheme;
  const currentTheme = THEMES.find((t) => t.id === effectiveId) || THEMES[1];
  const Icon = currentTheme.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors flex items-center justify-center"
        aria-label="Select theme"
        aria-expanded={open}
      >
        <Icon size={16} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-popover rounded-xl shadow-pop overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 p-1.5">
          <p className="px-2 pt-1.5 pb-1 text-[11.5px] font-medium text-muted-foreground">Theme</p>
          {THEMES.map((t) => {
            const isActive = effectiveId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-[13px] rounded-md transition-colors text-left ${
                  isActive ? "text-foreground" : "text-foreground/80 hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-black/15"
                  style={{ background: t.dot }}
                  aria-hidden="true"
                />
                <span className="flex-1">
                  {t.name}
                  <span className="block text-[11px] text-muted-foreground">{t.blurb}</span>
                </span>
                {isActive && <Check size={14} className="text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
