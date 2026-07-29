export default function EnvironmentsLoading() {
  return (
    <div className="w-full h-full flex flex-col bg-surface-base">
      <header className="px-8 py-4 flex items-center justify-end shrink-0">
        <div className="w-36 h-10 bg-surface-border/50 rounded-xl animate-pulse" />
      </header>

      <div className="flex-1 px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-elevated border border-surface-border rounded-2xl p-6 h-48 animate-pulse flex flex-col justify-between">
              <div>
                <div className="w-24 h-4 bg-surface-border rounded mb-3" />
                <div className="w-48 h-6 bg-surface-border/80 rounded" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="w-20 h-4 bg-surface-border/60 rounded" />
                  <div className="w-8 h-4 bg-surface-border rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="w-20 h-4 bg-surface-border/60 rounded" />
                  <div className="w-24 h-4 bg-surface-border/80 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
