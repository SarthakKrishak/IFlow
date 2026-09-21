/**
 * Lightweight theme-aware loading skeletons.
 * Used by route loading.tsx files and next/dynamic fallbacks so users see
 * layout-shaped progress instead of a blank page.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-border/60 ${className}`} aria-hidden="true" />;
}

export function BoardSkeleton() {
  return (
    <div className="flex flex-col h-full p-6 gap-4" role="status" aria-label="Loading board">
      <div className="flex items-center gap-3">
        <Bar className="h-8 w-8 !rounded-lg" />
        <Bar className="h-5 w-48" />
        <Bar className="h-4 w-24" />
      </div>
      <div className="flex gap-6 overflow-hidden">
        {[0, 1, 2, 3].map((col) => (
          <div key={col} className="w-[300px] flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Bar className="h-2 w-2 !rounded-full" />
              <Bar className="h-3.5 w-24" />
              <Bar className="h-4 w-8" />
            </div>
            {[0, 1, 2].map((card) => (
              <div key={card} className="rounded-xl border border-surface-border bg-surface-elevated p-3 space-y-2">
                <Bar className="h-3 w-16" />
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-1">
                  <Bar className="h-5 w-16" />
                  <Bar className="h-6 w-6 !rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4" role="status" aria-label="Loading tasks">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 flex items-center gap-4">
        <Bar className="h-11 w-11 !rounded-xl" />
        <div className="space-y-2 flex-1">
          <Bar className="h-4 w-48" />
          <Bar className="h-3 w-72" />
        </div>
        <Bar className="h-2 w-40 hidden sm:block" />
      </div>
      <div className="rounded-2xl border border-surface-border bg-surface-elevated overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-border last:border-0">
            <Bar className="h-4 w-4 !rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Bar className="h-3.5 w-2/5" />
              <Bar className="h-3 w-1/4" />
            </div>
            <Bar className="h-6 w-24 hidden md:block" />
            <Bar className="h-6 w-20 hidden lg:block" />
            <Bar className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-border bg-surface-elevated p-5 flex items-center gap-4">
            <Bar className="h-12 w-12 !rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Bar className="h-3 w-20" />
              <Bar className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>
      <Bar className="h-72 w-full !rounded-3xl" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Bar className="h-64 w-full !rounded-3xl" />
        <Bar className="h-64 w-full !rounded-3xl" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-6" role="status" aria-label="Loading reports">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-border bg-surface-elevated p-5 space-y-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-7 w-14" />
          </div>
        ))}
      </div>
      <Bar className="h-80 w-full !rounded-3xl" />
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="h-full flex flex-col px-4 md:px-8 py-8 items-center gap-4" role="status" aria-label="Loading editor">
      <div className="w-full max-w-4xl rounded-xl border border-surface-border bg-surface-elevated p-8 sm:p-12 space-y-3">
        <Bar className="h-8 w-1/3" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-4/6" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-3/6" />
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 bg-surface-elevated border-l border-surface-border p-5 space-y-4" style={{ width: "clamp(360px, 600px, 100vw)" }} role="status" aria-label="Loading ticket">
      <Bar className="h-4 w-32" />
      <Bar className="h-7 w-3/4" />
      <div className="flex gap-2">
        <Bar className="h-8 w-28" />
        <Bar className="h-8 w-28" />
      </div>
      <Bar className="h-32 w-full !rounded-xl" />
      <Bar className="h-24 w-full !rounded-xl" />
    </div>
  );
}
