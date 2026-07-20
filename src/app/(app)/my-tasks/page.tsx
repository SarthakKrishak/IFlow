import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { PriorityChip, DepartmentTag } from "@/components/shared";
import Link from "next/link";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export const metadata: Metadata = { title: "My Tasks - IFlow" };

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user) return null;

  const tickets = await prisma.ticket.findMany({
    where: { assigneeId: session.user.id },
    include: {
      board: true,
      column: true,
      labels: true,
    },
    orderBy: { dueDate: "asc" },
  });

  const getStatusIcon = (columnName: string) => {
    const name = columnName.toLowerCase();
    if (name.includes("done")) return <CheckCircle2 className="text-green-500" size={16} />;
    if (name.includes("progress")) return <Clock className="text-blue-500" size={16} />;
    return <Circle className="text-muted-foreground" size={16} />;
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">All tasks currently assigned to you across all projects.</p>
      </div>

      <div className="bg-surface-elevated border border-surface-border rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-base text-muted-foreground text-[12px] uppercase tracking-wider border-b border-surface-border">
              <tr>
                <th className="px-6 py-4 font-medium">Task Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Board</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    You have no tasks assigned to you right now. You're all caught up! 🎉
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-surface-base/50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/board/${ticket.boardId}`} className="font-medium text-foreground group-hover:text-primary transition-colors block">
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.column.name)}
                        <span className="text-foreground">{ticket.column.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <Link href={`/board/${ticket.boardId}`} className="hover:text-foreground hover:underline">
                        {ticket.board.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <PriorityChip priority={ticket.priority} />
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
