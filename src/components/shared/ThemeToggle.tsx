"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Droplet, TreePine, Sunset, Palette } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const THEMES = [
  { id: "light", name: "Light", icon: Sun },
  { id: "dark", name: "Dark", icon: Moon },
  { id: "ocean", name: "Ocean", icon: Droplet },
  { id: "forest", name: "Forest", icon: TreePine },
  { id: "sunset", name: "Sunset", icon: Sunset },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
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
    return <div className="w-8 h-8" />;
  }

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[1];
  const Icon = currentTheme.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-all flex items-center gap-2"
        aria-label="Select theme"
      >
        <Icon size={16} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-40 bg-surface-elevated border border-surface-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 p-1">
          {THEMES.map((t) => {
            const TIcon = t.icon;
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-colors text-left ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-base"
                }`}
              >
                <TIcon size={14} />
                {t.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
