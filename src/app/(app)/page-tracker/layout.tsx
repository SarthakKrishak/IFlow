import { redirect } from "next/navigation";
import { getCachedSession } from "@/lib/queries";
import { getPendingReviewCount } from "@/lib/page-tracker/queries";
import { TrackerTabs } from "@/components/page-tracker/TrackerTabs";

export default async function PageTrackerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession();
  if (!session?.user) redirect("/login");
  const pending = await getPendingReviewCount(session.user.id);
  const isLead = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  return (
    <div className="w-full flex-1 flex flex-col text-foreground min-h-0">
      <TrackerTabs isLead={isLead} pendingReviews={pending} />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
