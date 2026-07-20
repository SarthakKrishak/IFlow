"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { addCommentSchema } from "@/lib/validators";
import type { Comment } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export async function addComment(input: {
  ticketId: string;
  body: string;
}): Promise<Result<Comment>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const parsed = addCommentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, body } = parsed.data;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { success: false, error: "Ticket not found" };

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          ticketId,
          authorId: session.user.id,
          body,
        },
      });

      await logActivity(tx, {
        ticketId,
        userId: session.user.id,
        action: "COMMENTED",
        toValue: body.substring(0, 100) + (body.length > 100 ? "…" : ""),
      });

      return c;
    });

    return { success: true, data: comment };
  } catch (error) {
    console.error("addComment error:", error);
    return { success: false, error: "Failed to add comment" };
  }
}
