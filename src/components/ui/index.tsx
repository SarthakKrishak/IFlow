"use client";

/**
 * IFlow UI kit — the single visual vocabulary for the whole product.
 *
 * Rules (derived from Linear / Vercel Geist patterns):
 *  - Theme tokens only: no hard-coded surface/brand colors, so all 8 themes stay in sync.
 *  - Two-level radius scale: controls = rounded-lg (8px), surfaces = rounded-xl (12px).
 *  - Control heights: sm 28px · md 32px · lg 40px.
 *  - Quiet chrome: hairline borders, near-flat surfaces, neutral hover states.
 *  - Accent (brand indigo) is reserved for primary actions, focus and selection —
 *    never as decoration (no tinted icon tiles, glows or gradient text).
 *  - Every data surface has loading, empty and error states.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonStyles, controlCls, TONE_SOFT, type ButtonSize, type ButtonVariant, type Tone } from "./styles";

// Pure helpers live in ./styles (server-safe); re-exported so callers can import everything from one place.
export { buttonStyles, controlCls, TONE_SOFT };
export type { ButtonSize, ButtonVariant, Tone };

// ── Buttons ─────────────────────────────────────────────────────────────────

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:shadow-ring disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "surface-card",
        interactive && "transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 hover:shadow-md cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 min-h-12 py-2.5 border-b border-surface-border", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-muted-foreground shrink-0 flex items-center [&>svg]:w-[15px] [&>svg]:h-[15px]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground truncate">{title}</h3>
          {description && <p className="text-[12px] text-muted-foreground truncate">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[12px] font-medium text-muted-foreground", className)}>{children}</p>
  );
}

// ── Page scaffolding ────────────────────────────────────────────────────────

/** Standard page padding + max width. Pass `wide` for dashboards. */
export function PageContainer({
  className,
  wide,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in",
        wide ? "max-w-[1500px]" : "max-w-[1280px]",
        className
      )}
      {...props}
    />
  );
}

/** In-page toolbar: optional heading on the left, actions on the right. */
export function Toolbar({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {(title || description) && (
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
          {description && <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      {children && <div className="flex flex-wrap items-center gap-2 ml-auto">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "purple" | "neutral";
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon && <span className={cn("flex items-center [&>svg]:w-[14px] [&>svg]:h-[14px]", TONE_TEXT[tone])}>{icon}</span>}
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-foreground mt-3 tabular-nums">{value}</p>
      {hint && <p className="text-[12px] text-muted-foreground mt-2">{hint}</p>}
    </Card>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-500",
  info: "text-sky-600 dark:text-sky-400",
  purple: "text-purple-600 dark:text-purple-400",
  neutral: "text-muted-foreground",
};

/**
 * Groups StatCards into one hairline-divided strip (one surface, several readings)
 * instead of a row of separate floating cards.
 */
export function StatGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border shadow-card",
        "[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-1.5 rounded-md text-[11.5px] font-medium whitespace-nowrap",
        TONE_SOFT[tone],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center h-[18px] px-1.5 rounded border border-surface-border bg-surface-base text-[10.5px] font-sans font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

// ── Form controls ───────────────────────────────────────────────────────────

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlCls, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(controlCls, "pr-8 cursor-pointer", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlCls, "min-h-[84px] py-2.5 leading-relaxed resize-y", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[12.5px] font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="text-[12px] text-red-500 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex p-0.5 rounded-lg bg-foreground/[0.05] border border-surface-border", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-surface-elevated text-foreground shadow-sm ring-1 ring-surface-border" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "primary", className }: { value: number; tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
    purple: "bg-purple-500",
    neutral: "bg-muted-foreground",
  };
  return (
    <div className={cn("h-1.5 rounded-full bg-foreground/[0.07] overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", color[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** One clear next step. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-surface-border px-6 py-12",
        className
      )}
    >
      {icon && (
        <div className="text-muted-foreground/70 mb-3 [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
      )}
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {description && <p className="text-[13px] text-muted-foreground mt-1 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-red-500/20 bg-red-500/[0.04] px-6 py-12">
      <AlertTriangle size={22} className="text-red-500 mb-3" />
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      {description && <p className="text-[13px] text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-muted-foreground", className)} />;
}

// ── Dialog ──────────────────────────────────────────────────────────────────

export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  const width = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "bg-surface-elevated w-full max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl shadow-2xl border border-surface-border overflow-hidden outline-none animate-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200",
          width
        )}
      >
        <div className="px-5 py-4 border-b border-surface-border flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[14px] font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="text-[12.5px] text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-surface-border flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ── Confirm (replaces window.confirm) ───────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

/**
 * Promise-based confirmation dialog:
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Delete?", danger: true }))) return;
 *   …render {dialog} once in the component tree.
 */
export function useConfirm() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = state ? (
    <Dialog
      size="sm"
      title={state.opts.title}
      description={state.opts.description}
      onClose={() => close(false)}
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button
            variant="primary"
            className={state.opts.danger ? "!bg-red-600 hover:!bg-red-700 !text-white" : undefined}
            onClick={() => close(true)}
            autoFocus
          >
            {state.opts.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {null}
    </Dialog>
  ) : null;

  return { confirm, dialog };
}
