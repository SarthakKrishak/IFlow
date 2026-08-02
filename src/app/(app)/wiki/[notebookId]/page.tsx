import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotebookClient from "./NotebookClient";

export async function generateMetadata({ params }: { params: Promise<{ notebookId: string }> }) {
  const { notebookId } = await params;
  const nb = await prisma.notebook.findUnique({ where: { id: notebookId } });
  return { title: nb ? `${nb.title} | Wiki` : "Notebook | Wiki" };
}

export default async function NotebookPage({ params }: { params: Promise<{ notebookId: string }> }) {
  const { notebookId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      pages: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!notebook) {
    return <div className="p-8">Notebook not found.</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base overflow-hidden">
      <NotebookClient notebook={notebook} />
    </div>
  );
}
