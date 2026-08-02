import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import WikiClient from "./WikiClient";

export const metadata = {
  title: "Wiki | IFlow",
};

export default async function WikiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectId = (await prisma.project.findFirst())?.id;
  if (!projectId) {
    return <div className="p-8 text-muted-foreground">No active project found.</div>;
  }

  const notebooks = await prisma.notebook.findMany({
    where: { projectId },
    include: {
      _count: { select: { pages: true } },
      createdBy: { select: { displayName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base overflow-hidden">
      <WikiClient initialNotebooks={notebooks} projectId={projectId} />
    </div>
  );
}
