"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Waves, Crown, Zap, CircleDot, Palette, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const THEMES = [
  { id: "light", name: "Light", icon: Sun, dot: "#0969DA", blurb: "GitHub Light" },
  { id: "dark", name: "Dark+", icon: Moon, dot: "#1F8AD6", blurb: "VSCode Dark+" },
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
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Palette size={15} />
        <span className="text-[13px] font-medium">Theme</span>
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
        className="px-3 py-1.5 rounded-xl text-foreground hover:bg-surface-base transition-all flex items-center gap-2"
        aria-label="Select theme"
        aria-expanded={open}
      >
        <Icon size={15} className="text-muted-foreground" />
        <span className="text-[13px] font-medium">Theme</span>
        <span
          className="w-3 h-3 rounded-full ring-1 ring-black/20"
          style={{ background: currentTheme.dot }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-surface-elevated border border-surface-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 p-1.5">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Appearance
          </p>
          {THEMES.map((t) => {
            const TIcon = t.icon;
            const isActive = effectiveId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors text-left ${
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-base"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-black/20"
                  style={{ background: t.dot }}
                  aria-hidden="true"
                />
                <TIcon size={14} className="flex-shrink-0" />
                <span className="flex-1">
                  {t.name}
                  <span className="block text-[10px] font-normal opacity-70">{t.blurb}</span>
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
