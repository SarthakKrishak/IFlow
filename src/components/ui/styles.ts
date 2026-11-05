/**
 * Pure style helpers for the UI kit. NO "use client" and no React imports, so
 * server components (e.g. not-found, loading states) can use them directly.
 */
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";
export type Tone = "primary" | "success" | "warning" | "danger" | "info" | "purple" | "neutral";

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-ring";
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12.5px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-10 px-4 text-[14px]",
};
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-btn hover:brightness-110",
  secondary:
    "bg-surface-elevated text-foreground border border-surface-border shadow-sm hover:bg-surface-hover hover:border-foreground/15",
  soft: "bg-primary/10 text-primary hover:bg-primary/[0.16]",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
  danger: "bg-surface-elevated text-red-600 dark:text-red-400 border border-surface-border shadow-sm hover:bg-red-500/10 hover:border-red-500/30",
};

/** Class string for anything that must look like a button (e.g. next/link). */
export function buttonStyles(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], className);
}

export const controlCls =
  "w-full min-h-8 py-[6px] bg-surface-elevated border border-surface-border rounded-lg px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] hover:border-foreground/20 focus:outline-none focus-visible:outline-none focus:border-primary/60 focus:shadow-ring disabled:opacity-60 disabled:cursor-not-allowed";

export const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-500",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  neutral: "bg-foreground/[0.06] text-muted-foreground",
};
