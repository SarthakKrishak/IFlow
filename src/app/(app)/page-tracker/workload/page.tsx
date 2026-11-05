import { isMissingSchema } from "@/lib/page-tracker/server";
import { TrackerSetupNeeded } from "@/components/page-tracker/TrackerSetupNeeded";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCachedSession, getCachedActiveProject } from "@/lib/queries";
import { getWorkload } from "@/lib/page-tracker/queries";
import { WorkloadClient } from "@/components/page-tracker/WorkloadClient";

export const metadata: Metadata = { title: "Workload — Page Tracker — IFlow" };
export const dynamic = "force-dynamic";

export default async function WorkloadPage() {
  const [session, project] = await Promise.all([getCachedSession(), getCachedActiveProject()]);
  if (!session?.user || !project) return null;
  // Team workload is a lead view (it is visibility, not a performance ranking).
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") redirect("/page-tracker");
  try {
    const rows = await getWorkload(project.id);
    return <WorkloadClient rows={rows} />;
  } catch (e) {
    if (isMissingSchema(e)) return <TrackerSetupNeeded />;
    throw e;
  }
}
