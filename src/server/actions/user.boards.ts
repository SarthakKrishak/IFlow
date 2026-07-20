"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function updateUserBoards({ userId, boardIds }: { userId: string, boardIds: string[] }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // We want to set the exact board ids for this user.
    // In prisma, we can update the user's boards relation.
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessibleBoards: {
          set: boardIds.map(id => ({ id }))
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("updateUserBoards error:", error);
    return { success: false, error: "Failed to update board access" };
  }
}
