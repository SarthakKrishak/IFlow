"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { z } from "zod";
import type { Ticket } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const setAssigneesSchema = z.object({
  ticketId: z.string().cuid(),
  assigneeIds: z.array(z.string().cuid()).max(10, "Max 10 assignees"),
});

/**
 * Multi-assign: replaces the ticket's assignee set.
 * Keeps legacy `Ticket.assigneeId` in sync (first id = primary) so every
 * existing query (board, my-tasks, calendar, reports) keeps working unchanged.
 */
export async function setTicketAssignees(input: {
  ticketId: string;
  assigneeIds: string[];
}): Promise<Result<Ticket>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const parsed = setAssigneesSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, assigneeIds } = parsed.data;
    const uniqueIds = Array.from(new Set(assigneeIds));

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignee: { select: { displayName: true } } },
    });
    if (!ticket) return { success: false, error: "Ticket not found" };

    // Validate all users exist & active
    if (uniqueIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueIds }, isActive: true },
        select: { id: true, displayName: true, role: true },
      });
      if (users.length !== uniqueIds.length)
        return { success: false, error: "One or more users are invalid" };
      // The admin account is never assigned work
      if (users.some((u) => u.role === "ADMIN"))
        return { success: false, error: "Cannot assign to the admin account" };
    }

    const primaryId = uniqueIds[0] ?? null;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.ticketAssignee.deleteMany({ where: { ticketId } });
        if (uniqueIds.length > 0) {
          await tx.ticketAssignee.createMany({
            data: uniqueIds.map((userId) => ({ ticketId, userId })),
          });
        }
        const t = await tx.ticket.update({
          where: { id: ticketId },
          data: { assigneeId: primaryId },
        });

        const prevName = ticket.assignee?.displayName ?? "Unassigned";
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: primaryId ? "ASSIGNED" : "UNASSIGNED",
          fromValue: prevName,
          toValue: uniqueIds.length > 1 ? `${uniqueIds.length} people` : undefined,
        });
        return t;
      });

      return { success: true, data: updated };
    } catch (txError: any) {
      // Fallback ONLY when the additive TicketAssignee table is missing
      // (pre-migration DBs): keep legacy single-assignee behavior.
      // Any other error is a real failure and must surface.
      const isMissingTable =
        txError?.code === "P2021" ||
        String(txError?.message ?? "").includes("TicketAssignee");
      if (!isMissingTable) {
        console.error("setTicketAssignees error:", txError);
        return { success: false, error: "Failed to update assignees" };
      }
      console.error("setTicketAssignees multi fallback (non-blocking):", txError);
      const fallback = await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.update({
          where: { id: ticketId },
          data: { assigneeId: primaryId },
        });
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: primaryId ? "ASSIGNED" : "UNASSIGNED",
          fromValue: ticket.assignee?.displayName,
        });
        return t;
      });
      return { success: true, data: fallback };
    }
  } catch (error) {
    console.error("setTicketAssignees error:", error);
    return { success: false, error: "Failed to update assignees" };
  }
}
