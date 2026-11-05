import { DatabaseZap } from "lucide-react";

/** Shown instead of a crash when the Page Tracker migration hasn't been applied to this database yet. */
export function TrackerSetupNeeded() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center rounded-xl border border-surface-border bg-surface-elevated p-8 shadow-card">
        <div className="mx-auto mb-3 flex justify-center text-muted-foreground">
          <DatabaseZap size={22} />
        </div>
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Page Tracker needs a one-time database update</h2>
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">
          The new tables haven’t been created in this database yet. Run the migration once, then reload this page:
        </p>
        <pre className="mt-4 text-left text-[12.5px] font-mono bg-surface-base border border-surface-border rounded-xl px-4 py-3 overflow-x-auto">
          npx prisma migrate deploy
        </pre>
      </div>
    </div>
  );
}
