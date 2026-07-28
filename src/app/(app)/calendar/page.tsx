import { Calendar as CalendarIcon } from "lucide-react";

export const metadata = {
  title: "Calendar — IFlow",
  description: "Manage your team's schedule and deadlines.",
};

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface-base items-center justify-center p-8 animate-fade-in">
      <div className="max-w-md w-full bg-surface-elevated border border-surface-border rounded-3xl p-10 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 ring-8 ring-primary/5">
          <CalendarIcon size={32} className="text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Calendar Coming Soon</h2>
        
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          We're working hard on bringing a fully integrated team calendar to IFlow. You'll soon be able to visualize deadlines, schedule sprints, and track milestones directly from this view.
        </p>
        
        <div className="mt-8 pt-6 border-t border-surface-border">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-base border border-surface-border text-xs font-semibold text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            In Active Development
          </div>
        </div>
      </div>
    </div>
  );
}
