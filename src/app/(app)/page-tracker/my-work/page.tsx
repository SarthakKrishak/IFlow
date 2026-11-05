import { isMissingSchema } from "@/lib/page-tracker/server";
import { TrackerSetupNeeded } from "@/components/page-tracker/TrackerSetupNeeded";
import type { Metadata } from "next";
import { getCachedSession, getCachedActiveProject } from "@/lib/queries";
import { getMyWork } from "@/lib/page-tracker/queries";
import { MyWorkClient } from "@/components/page-tracker/MyWorkClient";

export const metadata: Metadata = { title: "My Work — Page Tracker — IFlow" };
export const dynamic = "force-dynamic";

export default async function MyWorkPage() {
  const [session, project] = await Promise.all([getCachedSession(), getCachedActiveProject()]);
  if (!session?.user || !project) return null;
  try {
    const data = await getMyWork(session.user.id, project.id);
    return <MyWorkClient data={data} />;
  } catch (e) {
    if (isMissingSchema(e)) return <TrackerSetupNeeded />;
    throw e;
  }
}
