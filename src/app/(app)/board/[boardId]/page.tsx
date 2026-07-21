import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { TicketPanel } from "@/components/board/TicketPanel";
import { BoardPageClient } from "./BoardPageClient";
import { getCachedUsers } from "@/lib/queries";
import type { Metadata } from "next";

interface BoardPageProps {
  params: Promise<{ boardId: string }>;
}

export async function generateMetadata({ params }: BoardPageProps): Promise<Metadata> {
  const { boardId } = await params;
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { name: true } });
  return { title: board ? `${board.name} — IFlow` : "Board — IFlow" };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          tickets: {
            orderBy: { order: "asc" },
            include: {
              assignee: { select: { id: true, displayName: true, avatarColor: true } },
              labels: { select: { id: true, name: true, color: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });

  if (!board) notFound();

  const [allUsers, allLabels] = await Promise.all([
    getCachedUsers(),
    prisma.label.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <BoardPageClient
      board={board}
      columns={board.columns}
      allUsers={allUsers}
      allLabels={allLabels}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
