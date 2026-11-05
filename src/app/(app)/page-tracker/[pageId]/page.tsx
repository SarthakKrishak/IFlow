import { isMissingSchema } from "@/lib/page-tracker/server";
import { TrackerSetupNeeded } from "@/components/page-tracker/TrackerSetupNeeded";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCachedSession, getCachedActiveProject, getCachedUsers } from "@/lib/queries";
import { getPageDetail } from "@/lib/page-tracker/queries";
import { PageDetailClient } from "@/components/page-tracker/PageDetailClient";

export const dynamic = "force-dynamic";

export default async function PageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ item?: string; tab?: string }>;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  const [session, project, users] = await Promise.all([
    getCachedSession(),
    getCachedActiveProject(),
    getCachedUsers(),
  ]);
  if (!session?.user || !project) return null;

  let result;
  try {
    result = await Promise.all([
      getPageDetail(pageId, project.id),
      prisma.board.findMany({
        where: { projectId: project.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  } catch (e) {
    if (isMissingSchema(e)) return <TrackerSetupNeeded />;
    throw e;
  }
  const [detail, boards] = result;
  if (!detail) notFound();

  return (
    <PageDetailClient
      page={detail.page}
      activity={detail.activity}
      life={detail.life}
      boards={boards}
      viewer={{ id: session.user.id, role: session.user.role }}
      members={users.map((u) => ({ id: u.id, displayName: u.displayName, avatarColor: u.avatarColor, role: u.role }))}
      initialItemId={sp.item ?? null}
      initialTab={sp.tab === "bugs" ? "bugs" : "board"}
    />
  );
}
