"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateUserBoardsSchema = z.object({
  userId: z.string().cuid(),
  boardIds: z.array(z.string().cuid()).max(100),
});

export async function updateUserBoards({ userId, boardIds }: { userId: string, boardIds: string[] }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateUserBoardsSchema.safeParse({ userId, boardIds });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    // Only set boards that actually exist (ignore stale ids instead of failing)
    const existingBoards = await prisma.board.findMany({
      where: { id: { in: Array.from(new Set(parsed.data.boardIds)) } },
      select: { id: true },
    });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
    if (!target) return { success: false, error: "User not found" };

    // We want to set the exact board ids for this user.
    // In prisma, we can update the user's boards relation.
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        accessibleBoards: {
          set: existingBoards.map(b => ({ id: b.id }))
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("updateUserBoards error:", error);
    return { success: false, error: "Failed to update board access" };
  }
}
