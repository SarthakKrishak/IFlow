export default function AppLoading() {
  return (
    <div className="flex-1 p-8 flex items-center justify-center bg-surface-base">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
