"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { addCommentSchema } from "@/lib/validators";
import { extractMentionedUserIds } from "@/lib/mentions";
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, title: true, boardId: true },
    });
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

    // @mentions → in-portal notifications (fail-soft: never break commenting
    // if the additive Notification table hasn't been migrated yet).
    try {
      const members = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, username: true, displayName: true },
      });
      const mentionedIds = extractMentionedUserIds(body, members, session.user.id);
      if (mentionedIds.length > 0) {
        const authorName = session.user.displayName ?? session.user.username ?? "Someone";
        await prisma.notification.createMany({
          data: mentionedIds.map((userId) => ({
            userId,
            actorId: session.user.id,
            type: "MENTION",
            title: `${authorName} mentioned you`,
            body: `${ticket.title}: ${body.substring(0, 140)}${body.length > 140 ? "…" : ""}`,
            ticketId,
            commentId: comment.id,
          })),
        });
      }
    } catch (mentionError) {
      console.error("mention notification error (non-blocking):", mentionError);
    }

    return { success: true, data: comment };
  } catch (error) {
    console.error("addComment error:", error);
    return { success: false, error: "Failed to add comment" };
  }
}
