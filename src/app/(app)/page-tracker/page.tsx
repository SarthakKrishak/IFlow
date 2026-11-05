import { isMissingSchema } from "@/lib/page-tracker/server";
import { TrackerSetupNeeded } from "@/components/page-tracker/TrackerSetupNeeded";
import type { Metadata } from "next";
import { getCachedSession, getCachedActiveProject, getCachedUsers } from "@/lib/queries";
import { getTrackerOverview } from "@/lib/page-tracker/queries";
import { PageTrackerClient } from "@/components/page-tracker/PageTrackerClient";

export const metadata: Metadata = { title: "Page Tracker — IFlow" };

export default async function PageTrackerPage() {
  const [session, project, users] = await Promise.all([
    getCachedSession(),
    getCachedActiveProject(),
    getCachedUsers(),
  ]);
  if (!session?.user || !project) return null;
  let overview: Awaited<ReturnType<typeof getTrackerOverview>>;
  try {
    overview = await getTrackerOverview(project.id);
  } catch (e) {
    if (isMissingSchema(e)) return <TrackerSetupNeeded />;
    throw e;
  }
  return (
    <PageTrackerClient
      overview={overview}
      projectName={project.name}
      viewer={{ id: session.user.id, role: session.user.role }}
      members={users.map((u) => ({ id: u.id, displayName: u.displayName, avatarColor: u.avatarColor, role: u.role }))}
    />
  );
}
