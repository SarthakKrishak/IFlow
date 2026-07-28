function SkeletonTicketCard() {
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-2xl p-3 space-y-2 animate-pulse">
      <div className="h-3 w-3/4 bg-surface-border rounded" />
      <div className="h-3 w-1/2 bg-surface-border/60 rounded" />
      <div className="flex items-center gap-2 pt-1">
        <div className="h-5 w-12 bg-surface-border/50 rounded-full" />
        <div className="h-5 w-5 bg-surface-border/50 rounded-full ml-auto" />
      </div>
    </div>
  );
}

function SkeletonColumn() {
  return (
    <div className="flex-shrink-0 w-[280px] bg-surface-elevated border border-surface-border rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-surface-border rounded" />
        <div className="h-5 w-6 bg-surface-border/60 rounded-full" />
      </div>
      <SkeletonTicketCard />
      <SkeletonTicketCard />
      <SkeletonTicketCard />
    </div>
  );
}

export default function BoardLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden flex-1">
      {/* Board header skeleton */}
      <div className="flex items-center px-6 py-3 border-b border-surface-border animate-pulse">
        <div className="h-5 w-36 bg-surface-border rounded" />
      </div>
      {/* Columns skeleton */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex gap-4 h-full">
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
          <SkeletonColumn />
        </div>
      </div>
    </div>
  );
}
