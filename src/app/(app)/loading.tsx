export default function AppLoading() {
  return (
    <div className="flex h-screen bg-surface-base">
      {/* Sidebar Skeleton */}
      <div className="w-[280px] border-r border-surface-border bg-surface-elevated/50 flex flex-col">
        <div className="h-16 border-b border-surface-border flex items-center px-6">
          <div className="w-8 h-8 rounded-lg bg-surface-border animate-pulse" />
          <div className="ml-3 h-5 w-24 bg-surface-border rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="h-8 w-full bg-surface-border/50 rounded animate-pulse" />
          <div className="h-8 w-full bg-surface-border/50 rounded animate-pulse" />
          <div className="h-8 w-full bg-surface-border/50 rounded animate-pulse" />
          <div className="pt-6 space-y-4">
            <div className="h-4 w-16 bg-surface-border rounded animate-pulse" />
            <div className="h-8 w-full bg-surface-border/50 rounded animate-pulse" />
            <div className="h-8 w-full bg-surface-border/50 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topnav Skeleton */}
        <header className="h-16 border-b border-surface-border bg-surface-base flex items-center justify-between px-8">
          <div className="h-6 w-32 bg-surface-border rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-surface-border animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-surface-border animate-pulse" />
          </div>
        </header>

        {/* Page Content Loading Area */}
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading workspace...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
