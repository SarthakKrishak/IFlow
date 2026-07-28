import { getCachedSession } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { MyTasksClient } from "./MyTasksClient";

export const metadata: Metadata = { title: "My Tasks - IFlow" };

export default async function MyTasksPage() {
  const session = await getCachedSession();
  if (!session?.user) return null;

  const tickets = await prisma.ticket.findMany({
    where: { assigneeId: session.user.id },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      dueDate: true,
      boardId: true,
      board: { select: { name: true, project: { select: { name: true } } } },
      column: { select: { name: true, order: true } },
      labels: { select: { id: true, name: true, color: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return (
    <div className="w-full h-full bg-surface-base text-foreground">
      <MyTasksClient initialTickets={tickets} />
    </div>
  );
}
