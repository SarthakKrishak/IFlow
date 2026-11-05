import { isMissingSchema } from "@/lib/page-tracker/server";
import { TrackerSetupNeeded } from "@/components/page-tracker/TrackerSetupNeeded";
import type { Metadata } from "next";
import { getCachedSession, getCachedActiveProject } from "@/lib/queries";
import { getReviewQueue } from "@/lib/page-tracker/queries";
import { ReviewsClient } from "@/components/page-tracker/ReviewsClient";

export const metadata: Metadata = { title: "Reviews — Page Tracker — IFlow" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [session, project] = await Promise.all([getCachedSession(), getCachedActiveProject()]);
  if (!session?.user || !project) return null;
  try {
    const data = await getReviewQueue(session.user.id, project.id);
    return <ReviewsClient data={data} />;
  } catch (e) {
    if (isMissingSchema(e)) return <TrackerSetupNeeded />;
    throw e;
  }
}
