"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Ticket.board / Ticket.column have no DB-level cascade, so delete the
    // project's tickets first (comments, activity, assignees cascade from Ticket).
    const boards = await prisma.board.findMany({
      where: { projectId },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.ticket.deleteMany({ where: { boardId: { in: boards.map((b) => b.id) } } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);
    return { success: true };
  } catch (error: any) {
    console.error("deleteProject error:", error);
    return { success: false, error: "Failed to delete project" };
  }
}
