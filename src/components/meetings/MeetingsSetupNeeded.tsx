import { DatabaseZap } from "lucide-react";

/** Shown instead of a crash when the Meetings migration hasn't been applied yet. */
export function MeetingsSetupNeeded() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center surface-card p-8">
        <div className="mx-auto mb-3 flex justify-center text-muted-foreground">
          <DatabaseZap size={22} />
        </div>
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Meetings needs a one-time database update</h2>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">Run the migration once, then reload this page:</p>
        <pre className="mt-4 text-left text-[12.5px] font-mono bg-surface-base border border-surface-border rounded-xl px-4 py-3 overflow-x-auto">npx prisma migrate deploy</pre>
      </div>
    </div>
  );
}
