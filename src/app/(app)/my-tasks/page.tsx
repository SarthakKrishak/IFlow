import { getCachedSession } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { MyTasksClient } from "./MyTasksClient";

export const metadata: Metadata = { title: "My Tasks - IFlow" };

export default async function MyTasksPage() {
  const session = await getCachedSession();
  if (!session?.user) return null;

  const baseSelect = {
    id: true,
    title: true,
    description: true,
    priority: true,
    dueDate: true,
    boardId: true,
    board: { select: { name: true, project: { select: { name: true } } } },
    column: { select: { name: true, order: true } },
    labels: { select: { id: true, name: true, color: true } },
    assignee: { select: { id: true, displayName: true, avatarColor: true } },
  } as const;

  // Prefer assigneeId OR multi-assign match; fall back to legacy single-assignee
  // query if the additive TicketAssignee table hasn't been migrated yet.
  // Null due dates sort last so overdue work isn't buried.
  const orderBy = { dueDate: { sort: "asc" as const, nulls: "last" as const } };
  let tickets;
  try {
    tickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { assigneeId: session.user.id },
          { extraAssignees: { some: { userId: session.user.id } } },
        ],
      },
      select: baseSelect,
      orderBy,
    });
  } catch (error) {
    console.error("my-tasks multi-assign fallback (non-blocking):", error);
    tickets = await prisma.ticket.findMany({
      where: { assigneeId: session.user.id },
      select: baseSelect,
      orderBy,
    });
  }

  return (
    <div className="w-full h-full bg-surface-base text-foreground">
      <MyTasksClient initialTickets={tickets} />
    </div>
  );
}
