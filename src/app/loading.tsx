import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface-base">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
