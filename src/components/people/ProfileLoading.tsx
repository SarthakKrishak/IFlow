export function ProfileLoading() {
  const skeletonClass = "bg-surface-border/50 rounded-md animate-pulse";

  return (
    <div className="p-8 max-w-5xl mx-auto animate-pulse pb-24">
      {/* Back Link Skeleton */}
      <div className={`h-4 w-24 mb-8 ${skeletonClass}`} />

      {/* Header */}
      <div className="flex items-center gap-5 mb-8">
        <div className={`w-24 h-24 rounded-full flex-shrink-0 ${skeletonClass}`} />
        <div className="space-y-3">
          <div className={`h-8 w-48 ${skeletonClass}`} />
          <div className="flex gap-3">
            <div className={`h-5 w-16 rounded-full ${skeletonClass}`} />
            <div className={`h-5 w-32 ${skeletonClass}`} />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-start gap-4 h-32">
            <div className={`w-12 h-12 rounded-2xl flex-shrink-0 ${skeletonClass}`} />
            <div className="space-y-2 flex-1">
              <div className={`h-3 w-24 ${skeletonClass}`} />
              <div className={`h-8 w-16 ${skeletonClass}`} />
              <div className={`h-2.5 w-full max-w-[120px] ${skeletonClass}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="rounded-3xl p-6 mb-8 bg-surface-elevated border border-surface-border shadow-sm h-64 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className={`h-5 w-48 ${skeletonClass}`} />
          <div className={`h-8 w-32 rounded-xl ${skeletonClass}`} />
        </div>
        <div className={`flex-1 w-full rounded-xl ${skeletonClass}`} />
      </div>

      {/* Recent Activity */}
      <div className="rounded-3xl border border-surface-border shadow-sm overflow-hidden flex flex-col bg-surface-elevated h-[400px]">
        <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between">
          <div className={`h-5 w-32 ${skeletonClass}`} />
          <div className={`h-4 w-16 ${skeletonClass}`} />
        </div>
        <div className="p-6 space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 ${skeletonClass}`} />
                <div className="space-y-2">
                  <div className={`h-4 w-48 ${skeletonClass}`} />
                  <div className={`h-3 w-32 ${skeletonClass}`} />
                </div>
              </div>
              <div className={`h-4 w-24 ${skeletonClass}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
