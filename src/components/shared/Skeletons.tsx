/**
 * Route-shaped loading skeletons.
 *
 * Every skeleton reuses the SAME outer container classes as the page it stands
 * in for (padding, max-width, grid), so nothing jumps when the real content
 * arrives. The big animated IFlow loader is reserved for the very first load
 * of the app (see AppBootLoader); in-app navigation always shows one of these.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function Card({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`surface-card ${className}`}>{children}</div>;
}

/** Stat tile used by overview / reports / github / tracker summary rows. */
function StatTile({ icon = true }: { icon?: boolean }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      {icon && <Bar className="h-12 w-12 !rounded-xl shrink-0" />}
      <div className="space-y-2 flex-1">
        <Bar className="h-3 w-20" />
        <Bar className="h-6 w-14" />
      </div>
    </Card>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────

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
            {[0, 1, 2].slice(0, col === 3 ? 1 : 3).map((card) => (
              <Card key={card} className="p-3 space-y-2">
                <Bar className="h-3 w-16" />
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-1">
                  <Bar className="h-5 w-16" />
                  <Bar className="h-6 w-6 !rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── My Tasks ────────────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  // Mirrors My Tasks: KPI row → toolbar → list
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 pb-24 max-w-[1440px] mx-auto space-y-5" role="status" aria-label="Loading tasks">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="col-span-2 md:col-span-3 xl:col-span-1 p-4 flex items-center gap-4">
          <Bar className="h-14 w-14 !rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Bar className="h-3 w-16" />
            <Bar className="h-6 w-10" />
          </div>
        </Card>
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="flex justify-between">
              <Bar className="h-3 w-16" />
              <Bar className="h-7 w-7 !rounded-lg" />
            </div>
            <Bar className="h-7 w-10" />
          </Card>
        ))}
      </div>
      <Card className="p-3 space-y-3">
        <div className="flex gap-3">
          <Bar className="h-9 flex-1 !rounded-xl" />
          <Bar className="h-9 w-36 !rounded-xl hidden sm:block" />
          <Bar className="h-9 w-36 !rounded-xl hidden sm:block" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-7 w-24 !rounded-full" />
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="hidden md:block h-10 border-b border-surface-border bg-surface-base/60" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-surface-border last:border-0">
            <Bar className="h-[18px] w-[18px] !rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Bar className="h-3 w-16" />
              <Bar className="h-3.5 w-2/5" />
            </div>
            <Bar className="h-6 w-24 !rounded-full hidden md:block" />
            <Bar className="h-4 w-20 hidden lg:block" />
            <Bar className="h-6 w-16 !rounded-full hidden md:block" />
            <Bar className="h-8 w-24" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function PageSkeleton() {
  // Mirrors Overview: toolbar → KPIs → chart + deadlines → projects + activity → team + health
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 pb-20 max-w-[1440px] mx-auto space-y-6" role="status" aria-label="Loading dashboard">
      <div className="flex justify-between gap-3">
        <Bar className="h-10 w-72 !rounded-xl hidden md:block" />
        <div className="flex gap-2 ml-auto">
          <Bar className="h-9 w-40 !rounded-xl" />
          <Bar className="h-9 w-40 !rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex justify-between">
              <Bar className="h-10 w-10 !rounded-xl" />
              <Bar className="h-8 w-20" />
            </div>
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-16" />
            <Bar className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border space-y-2">
            <Bar className="h-4 w-36" />
            <Bar className="h-3 w-56" />
          </div>
          <div className="p-5">
            <Bar className="h-[300px] w-full !rounded-xl" />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <Bar className="h-4 w-40" />
          </div>
          <div className="p-5 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <Bar className="h-11 w-11 !rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-3.5 w-3/4" />
                  <Bar className="h-3 w-1/2" />
                </div>
                <Bar className="h-5 w-10 !rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <Bar className="h-4 w-24" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-surface-border last:border-0">
              <Bar className="h-8 w-8 !rounded-lg" />
              <Bar className="h-3.5 w-40" />
              <Bar className="h-2 w-32 ml-auto" />
            </div>
          ))}
        </Card>
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <Bar className="h-4 w-32" />
          </div>
          <div className="p-5 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Bar className="h-8 w-8 !rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bar className="h-3.5 w-full" />
                  <Bar className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto space-y-6 pb-24" role="status" aria-label="Loading reports">
      <Bar className="h-11 w-72 !rounded-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5 space-y-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-7 w-14" />
          </Card>
        ))}
      </div>
      <Card className="h-80 p-6">
        <Bar className="h-full w-full !rounded-xl" />
      </Card>
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────────────

export function PeopleSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto pb-24 space-y-5" role="status" aria-label="Loading people">
      <div className="flex flex-wrap gap-2">
        <Bar className="h-9 w-72 !rounded-xl" />
        <Bar className="h-9 w-32 !rounded-xl" />
        <Bar className="h-9 w-32 !rounded-xl" />
        <div className="flex gap-2 ml-auto">
          <Bar className="h-9 w-24 !rounded-xl" />
          <Bar className="h-9 w-32 !rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-5">
            <div className="flex items-center gap-3.5">
              <Bar className="h-12 w-12 !rounded-full" />
              <div className="space-y-2 flex-1">
                <Bar className="h-4 w-32" />
                <Bar className="h-3 w-20" />
              </div>
            </div>
            <Bar className="h-14 w-full !rounded-xl" />
            <Bar className="h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-5xl mx-auto space-y-5 pb-24" role="status" aria-label="Loading profile">
      <Bar className="h-4 w-24" />
      <Card className="p-6 flex items-center gap-5">
        <Bar className="h-[88px] w-[88px] !rounded-full shrink-0" />
        <div className="space-y-3 flex-1">
          <Bar className="h-7 w-56" />
          <div className="flex gap-2">
            <Bar className="h-5 w-16 !rounded-full" />
            <Bar className="h-5 w-24 !rounded-full" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <Bar className="h-3 w-28" />
            <Bar className="h-8 w-16" />
            <Bar className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <Card className="h-44 p-5">
        <Bar className="h-full w-full !rounded-xl" />
      </Card>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden" role="status" aria-label="Loading calendar">
      <div className="hidden lg:flex flex-col w-[280px] border-r border-surface-border p-6 gap-6">
        <Bar className="h-11 w-full !rounded-xl" />
        <div className="space-y-3">
          <Bar className="h-4 w-36" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Bar key={i} className="h-7 !rounded-full" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Bar className="h-3 w-24" />
          <Bar className="h-5 w-40" />
          <Bar className="h-5 w-32" />
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <Bar className="h-7 w-48" />
          <Bar className="h-9 w-40 !rounded-xl" />
        </div>
        <div className="grid grid-cols-7 gap-px flex-1 rounded-xl overflow-hidden border border-surface-border">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-surface-elevated p-2 min-h-[84px] space-y-2">
              <Bar className="h-3 w-5" />
              {i % 4 === 0 && <Bar className="h-4 w-full" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Wiki ────────────────────────────────────────────────────────────────────

export function WikiSkeleton() {
  return (
    <div className="flex-1 overflow-hidden" role="status" aria-label="Loading wiki">
      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto space-y-5">
        <div className="flex gap-2">
          <Bar className="h-9 w-72 !rounded-xl" />
          <Bar className="h-9 w-36 !rounded-xl ml-auto" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-5 min-h-[150px] flex flex-col">
              <Bar className="h-10 w-10 !rounded-xl mb-5" />
              <Bar className="h-4 w-3/4" />
              <div className="flex justify-between mt-auto pt-4">
                <Bar className="h-3 w-16" />
                <Bar className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="h-full flex flex-col px-4 md:px-8 py-8 items-center gap-4" role="status" aria-label="Loading editor">
      <Card className="w-full max-w-4xl p-8 sm:p-12 space-y-3">
        <Bar className="h-8 w-1/3" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-11/12" />
        <Bar className="h-4 w-4/6" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-3/6" />
      </Card>
    </div>
  );
}

// ── Expenses ────────────────────────────────────────────────────────────────

export function ExpensesSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 px-4 sm:px-6 lg:px-10 py-6" role="status" aria-label="Loading expenses">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Bar className="h-5 w-40" />
          <Bar className="h-3.5 w-72" />
        </div>
        <Bar className="h-9 w-32 !rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <Bar className="h-3 w-28" />
            <Bar className="h-8 w-32" />
            <Bar className="h-3 w-36" />
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <Bar className="h-4 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-border last:border-0">
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-1/3" />
              <Bar className="h-3 w-1/5" />
            </div>
            <Bar className="h-4 w-20" />
            <Bar className="h-4 w-24 hidden md:block" />
            <Bar className="h-4 w-24 hidden md:block" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function EnvironmentsSkeleton() {
  return (
    <div className="w-full h-full flex flex-col" role="status" aria-label="Loading environments">
      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto w-full space-y-5">
        <div className="flex gap-2">
          <Bar className="h-9 w-72 !rounded-xl" />
          <Bar className="h-9 w-40 !rounded-xl ml-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <Bar className="h-10 w-10 !rounded-xl" />
                <div className="space-y-2">
                  <Bar className="h-4 w-32" />
                  <Bar className="h-3 w-20" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <Bar className="h-5 w-24 !rounded-full" />
                <Bar className="h-5 w-24 !rounded-full" />
              </div>
              <div className="flex justify-between pt-4 border-t border-surface-border">
                <Bar className="h-6 w-28" />
                <Bar className="h-6 w-16 !rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DeploymentsSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-5xl mx-auto space-y-5" role="status" aria-label="Loading deployments">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Bar className="h-5 w-36" />
          <Bar className="h-3.5 w-64" />
        </div>
        <Bar className="h-9 w-28 !rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {[0, 1].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-surface-border">
              <div className="flex items-center gap-3.5">
                <Bar className="h-11 w-11 !rounded-xl" />
                <div className="space-y-2">
                  <Bar className="h-4 w-24" />
                  <Bar className="h-3 w-32" />
                </div>
              </div>
              <Bar className="h-5 w-16 !rounded-full" />
            </div>
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="flex justify-between px-5 py-3 border-b border-surface-border last:border-0">
                <Bar className="h-3.5 w-24" />
                <Bar className="h-3.5 w-36" />
              </div>
            ))}
            <div className="p-4 border-t border-surface-border">
              <Bar className="h-9 w-full !rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-6xl mx-auto space-y-5" role="status" aria-label="Loading admin">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-12" />
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <Bar className="h-9 w-72 !rounded-xl" />
        <Bar className="h-9 w-32 !rounded-xl" />
        <Bar className="h-9 w-32 !rounded-xl ml-auto" />
      </div>
      <Card className="overflow-hidden">
        <div className="h-10 border-b border-surface-border bg-surface-base/60" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-border last:border-0">
            <Bar className="h-8 w-8 !rounded-full" />
            <Bar className="h-4 w-40" />
            <Bar className="h-4 w-24 hidden sm:block" />
            <Bar className="h-8 w-24 ml-auto" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function GithubSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6" role="status" aria-label="Loading GitHub tracker">
      <Card className="p-5 flex gap-3">
        <Bar className="h-11 flex-1 !rounded-xl" />
        <Bar className="h-11 w-32 !rounded-xl" />
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5 space-y-5">
            <Bar className="h-10 w-10 !rounded-xl" />
            <div className="space-y-2">
              <Bar className="h-3 w-20" />
              <Bar className="h-7 w-16" />
            </div>
          </Card>
        ))}
      </div>
      <Card className="h-72 p-6">
        <Bar className="h-full w-full !rounded-xl" />
      </Card>
    </div>
  );
}

// ── Page Tracker ────────────────────────────────────────────────────────────

const TRACKER_PAD = "px-4 sm:px-6 lg:px-10 py-6 space-y-6";

export function TrackerOverviewSkeleton() {
  return (
    <div className={TRACKER_PAD} role="status" aria-label="Loading Page Tracker">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bar className="h-3 w-28" />
          <Bar className="h-8 w-44" />
          <Bar className="h-3.5 w-80 max-w-full" />
        </div>
        <Bar className="h-10 w-44 !rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-10" />
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Bar className="h-10 w-72 !rounded-xl" />
        <Bar className="h-10 w-32 !rounded-xl" />
        <Bar className="h-10 w-32 !rounded-xl" />
        <Bar className="h-10 w-28 !rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Bar className="h-3 w-20" />
                <Bar className="h-5 w-40" />
                <Bar className="h-3 w-3/4" />
              </div>
              <Bar className="h-6 w-28 !rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((c) => (
                <Bar key={c} className="h-[84px] !rounded-xl" />
              ))}
            </div>
            <Bar className="h-3 w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TrackerDetailSkeleton() {
  return (
    <div className={TRACKER_PAD} role="status" aria-label="Loading page">
      <Bar className="h-4 w-24" />
      <Card className="p-5 space-y-4">
        <div className="space-y-2">
          <Bar className="h-5 w-48 !rounded-full" />
          <Bar className="h-8 w-72 max-w-full" />
          <Bar className="h-3.5 w-3/5" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Bar key={i} className="h-20 !rounded-xl" />
          ))}
        </div>
        <Bar className="h-14 w-full !rounded-xl" />
      </Card>
      <div className="flex gap-2 border-b border-surface-border pb-2.5">
        <Bar className="h-5 w-28" />
        <Bar className="h-5 w-16" />
        <Bar className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {[2, 3, 1].map((n, c) => (
          <div key={c} className="space-y-3">
            <Bar className="h-5 w-32" />
            {Array.from({ length: n }).map((_, i) => (
              <Card key={i} className="p-3.5 space-y-3">
                <Bar className="h-4 w-4/5" />
                <div className="flex gap-1.5">
                  <Bar className="h-5 w-20 !rounded-full" />
                  <Bar className="h-5 w-14 !rounded-full" />
                </div>
                <Bar className="h-3.5 w-full" />
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackerListSkeleton() {
  return (
    <div className={TRACKER_PAD} role="status" aria-label="Loading">
      <div className="space-y-2">
        <Bar className="h-8 w-40" />
        <Bar className="h-3.5 w-96 max-w-full" />
      </div>
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border">
          <Bar className="h-4 w-44" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-3.5 border-b border-surface-border last:border-0">
            <div className="flex-1 min-w-[160px] space-y-2">
              <Bar className="h-4 w-2/3" />
              <Bar className="h-3 w-1/3" />
            </div>
            <Bar className="h-5 w-20 !rounded-full" />
            <Bar className="h-5 w-24 !rounded-full" />
            <Bar className="h-5 w-16 !rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────

export function PanelSkeleton() {
  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-50 bg-surface-elevated border-l border-surface-border p-5 space-y-4"
      style={{ width: "clamp(360px, 600px, 100vw)" }}
      role="status"
      aria-label="Loading ticket"
    >
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

/** Generic fallback for any route that doesn't ship its own skeleton. */
export function GenericSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6" role="status" aria-label="Loading">
      <Bar className="h-8 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <StatTile key={i} icon={false} />
        ))}
      </div>
      <Card className="h-72 p-6">
        <Bar className="h-full w-full !rounded-xl" />
      </Card>
    </div>
  );
}

export function MeetingsSkeleton() {
  // Mirrors Meetings → Upcoming: tabs + action, then day-grouped agenda cards
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1280px] mx-auto space-y-5 pb-24" role="status" aria-label="Loading meetings">
      <div className="flex gap-3">
        <Bar className="h-10 w-72 !rounded-xl" />
        <Bar className="h-9 w-40 !rounded-xl ml-auto" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="space-y-2.5">
          <Bar className="h-3.5 w-48" />
          {[0, 1, g === 0 ? 2 : 3].slice(0, g === 0 ? 3 : 2).map((i) => (
            <Card key={i} className="p-4 flex items-center gap-4">
              <div className="w-[110px] space-y-2 shrink-0">
                <Bar className="h-5 w-20" />
                <Bar className="h-3 w-12" />
              </div>
              <div className="flex-1 space-y-2">
                <Bar className="h-4 w-1/3" />
                <Bar className="h-3 w-1/2" />
              </div>
              <Bar className="h-6 w-20 hidden md:block" />
              <Bar className="h-8 w-20 !rounded-xl" />
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
