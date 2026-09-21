import { getCachedSession, getCachedUsers, getCachedLabels, getCachedBoard } from "@/lib/queries";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardPageClient } from "./BoardPageClient";
import { BoardSkeleton } from "@/components/shared/Skeletons";
import { startOfDay } from "date-fns";
import type { Metadata } from "next";

interface BoardPageProps {
  params: Promise<{ boardId: string }>;
}

export async function generateMetadata({ params }: BoardPageProps): Promise<Metadata> {
  const { boardId } = await params;
  // Uses React.cache() — no duplicate DB call when page() also calls getCachedBoard
  const board = await getCachedBoard(boardId);
  return { title: board ? `${board.name} — IFlow` : "Board — IFlow" };
}

import { prisma } from "@/lib/prisma";

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;

  // Fetch sequentially to prevent Supabase connection pool exhaustion (P1001 error)
  const session = await getCachedSession();
  if (!session?.user) return null;

  // Board + users + labels are independent once we know who is asking —
  // one round-trip instead of three.
  const [board, allUsers, allLabels] = await Promise.all([
    getCachedBoard(boardId),
    getCachedUsers(),
    getCachedLabels(),
  ]);
  if (!board) notFound();

  // Auto-move overdue To Do tickets to Backlog
  const todoCol = board.columns.find(c => c.name.toLowerCase().replace(/\s+/g, '') === 'todo');
  const backlogCol = board.columns.find(c => c.name.toLowerCase().replace(/\s+/g, '') === 'backlog');
  if (todoCol && backlogCol) {
    const todayStart = startOfDay(new Date());

    // Only overdue if the due date is strictly before today
    const overdueTickets = todoCol.tickets.filter(t => t.dueDate && startOfDay(new Date(t.dueDate)) < todayStart);

    if (overdueTickets.length > 0) {
      try {
        await prisma.ticket.updateMany({
          where: { id: { in: overdueTickets.map(t => t.id) } },
          data: { columnId: backlogCol.id }
        });

        todoCol.tickets = todoCol.tickets.filter(t => !t.dueDate || startOfDay(new Date(t.dueDate)) >= todayStart);
        // Keep the in-memory objects consistent with the DB write above
        backlogCol.tickets = [
          ...backlogCol.tickets,
          ...overdueTickets.map(t => ({ ...t, columnId: backlogCol.id })),
        ];
      } catch (error) {
        console.error("Failed to auto-move overdue tickets:", error);
      }
    }
  }

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageClient
        board={board}
        columns={board.columns}
        allUsers={allUsers}
        allLabels={allLabels}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </Suspense>
  );
}
