import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCachedActiveProject, getCachedSession } from "@/lib/queries";
import { getMeetingsPageData } from "@/lib/meetings/queries";
import { isMissingSchema } from "@/lib/page-tracker/server";
import { MeetingsClient } from "@/components/meetings/MeetingsClient";
import { MeetingsSetupNeeded } from "@/components/meetings/MeetingsSetupNeeded";

export const metadata: Metadata = { title: "Meetings — IFlow" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; meeting?: string }>;
}) {
  const [session, project, sp, h] = await Promise.all([getCachedSession(), getCachedActiveProject(), searchParams, headers()]);
  if (!session?.user || !project) return null;

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";

  let data;
  try {
    data = await getMeetingsPageData(project.id, `${proto}://${host}`);
  } catch (e) {
    if (isMissingSchema(e)) return <MeetingsSetupNeeded />;
    throw e;
  }

  return (
    <MeetingsClient
      meetings={data.meetings}
      members={data.members}
      connection={data.connection}
      viewer={{ id: session.user.id, role: session.user.role }}
      flash={{ connected: sp.connected === "1", error: sp.error ?? null }}
      focusMeetingId={sp.meeting ?? null}
    />
  );
}
