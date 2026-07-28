export default function AdminLoading() {
  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-36 bg-surface-border rounded-lg mb-2" />
        <div className="h-4 w-52 bg-surface-border/60 rounded" />
      </div>
      <div className="bg-surface-elevated border border-surface-border rounded-3xl overflow-hidden">
        <div className="flex gap-6 px-6 py-4 border-b border-surface-border bg-surface-base">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-20 bg-surface-border/60 rounded flex-1" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-surface-border last:border-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-surface-border flex-shrink-0" />
              <div className="h-4 w-28 bg-surface-border rounded" />
            </div>
            <div className="h-4 w-20 bg-surface-border/60 rounded flex-1" />
            <div className="h-5 w-16 bg-surface-border/40 rounded-full flex-1" />
            <div className="h-5 w-20 bg-surface-border/40 rounded-full flex-1" />
            <div className="h-8 w-24 bg-surface-border/30 rounded-lg flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
