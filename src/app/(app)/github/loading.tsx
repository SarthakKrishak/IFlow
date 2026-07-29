export default function GithubLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex gap-4">
        <div className="h-10 w-64 bg-surface-border rounded-xl animate-pulse" />
        <div className="h-10 w-24 bg-surface-border rounded-xl animate-pulse" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-surface-elevated border border-surface-border rounded-2xl animate-pulse" />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-surface-elevated border border-surface-border rounded-3xl animate-pulse" />
        <div className="h-96 bg-surface-elevated border border-surface-border rounded-3xl animate-pulse" />
      </div>
      
      <div className="h-80 bg-surface-elevated border border-surface-border rounded-3xl animate-pulse" />
    </div>
  );
}
