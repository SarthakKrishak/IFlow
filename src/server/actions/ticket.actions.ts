"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  createTicketSchema,
  updateTicketSchema,
  moveTicketSchema,
  assignTicketSchema,
  labelTicketSchema,
  deleteTicketSchema,
} from "@/lib/validators";
import type { Ticket } from "@/lib/prisma-client";
import { Role } from "@/lib/prisma-client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

export async function createTicket(input: {
  boardId: string;
  columnId: string;
  title: string;
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { boardId, columnId, title } = parsed.data;

    // Get the board's department and max order in column
    const [board, maxOrderResult] = await Promise.all([
      prisma.board.findUnique({ where: { id: boardId }, select: { department: true } }),
      prisma.ticket.aggregate({ where: { columnId }, _max: { order: true } }),
    ]);

    if (!board) return { success: false, error: "Board not found" };

    const order = (maxOrderResult._max.order ?? -1) + 1;

    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          boardId,
          columnId,
          title,
          priority: "MEDIUM",
          department: board.department,
          order,
          createdById: session.user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          ticketId: t.id,
          userId: session.user.id,
          action: "CREATED",
        },
      });

      return t;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("createTicket error:", error);
    return { success: false, error: "Failed to create ticket" };
  }
}

export async function updateTicket(input: {
  ticketId: string;
  changes: {
    title?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: string | null;
    department?: "DEV" | "DESIGN" | "MARKETING" | "GENERAL";
  };
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = updateTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, changes } = parsed.data;

    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { priority: true, dueDate: true },
    });
    if (!existingTicket) return { success: false, error: "Ticket not found" };

    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          ...(changes.title !== undefined && { title: changes.title }),
          ...(changes.description !== undefined && { description: changes.description }),
          ...(changes.priority !== undefined && { priority: changes.priority }),
          ...(changes.dueDate !== undefined && {
            dueDate: changes.dueDate ? new Date(changes.dueDate) : null,
          }),
          ...(changes.department !== undefined && { department: changes.department }),
        },
      });

      // Log specific action types per spec
      if (changes.priority !== undefined && changes.priority !== existingTicket.priority) {
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: "PRIORITY_CHANGED",
          fromValue: existingTicket.priority,
          toValue: changes.priority,
        });
      } else if (changes.dueDate !== undefined) {
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: "DUE_DATE_CHANGED",
          fromValue: existingTicket.dueDate?.toISOString(),
          toValue: changes.dueDate ?? undefined,
        });
      } else {
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: "EDITED",
        });
      }

      return updated;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("updateTicket error:", error);
    return { success: false, error: "Failed to update ticket" };
  }
}

export async function moveTicket(input: {
  ticketId: string;
  toColumnId: string;
  toOrder: number;
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = moveTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, toColumnId, toOrder } = parsed.data;

    const [existingTicket, toColumn] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { column: { select: { name: true } } },
      }),
      prisma.column.findUnique({ where: { id: toColumnId }, select: { name: true, id: true } }),
    ]);

    if (!existingTicket) return { success: false, error: "Ticket not found" };
    if (!toColumn) return { success: false, error: "Target column not found" };

    const fromColumnName = existingTicket.column.name;
    const toColumnName = toColumn.name;
    const isDone = toColumnName === "Done";
    const wasInDone = fromColumnName === "Done";

    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          columnId: toColumnId,
          order: toOrder,
          ...(isDone && !wasInDone && { completedAt: new Date() }),
          ...(!isDone && wasInDone && { completedAt: null }),
        },
      });

      if (wasInDone && !isDone) {
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: "REOPENED",
          fromValue: fromColumnName,
          toValue: toColumnName,
        });
      } else {
        await logActivity(tx, {
          ticketId,
          userId: session.user.id,
          action: "MOVED",
          fromValue: fromColumnName,
          toValue: toColumnName,
        });
      }

      return updated;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("moveTicket error:", error);
    return { success: false, error: "Failed to move ticket" };
  }
}

export async function assignTicket(input: {
  ticketId: string;
  assigneeId: string | null;
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = assignTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, assigneeId } = parsed.data;

    // Parallelise: fetch existing ticket and new assignee simultaneously
    const [existingTicket, newAssignee] = await Promise.all([
      prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { assignee: { select: { displayName: true } } },
      }),
      assigneeId
        ? prisma.user.findUnique({ where: { id: assigneeId }, select: { displayName: true } })
        : Promise.resolve(null),
    ]);
    if (!existingTicket) return { success: false, error: "Ticket not found" };
    const newAssigneeName = newAssignee?.displayName;

    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { assigneeId },
      });

      await logActivity(tx, {
        ticketId,
        userId: session.user.id,
        action: assigneeId ? "ASSIGNED" : "UNASSIGNED",
        fromValue: existingTicket.assignee?.displayName,
        toValue: newAssigneeName,
      });

      return updated;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("assignTicket error:", error);
    return { success: false, error: "Failed to assign ticket" };
  }
}

export async function addLabel(input: {
  ticketId: string;
  labelId: string;
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = labelTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, labelId } = parsed.data;

    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) return { success: false, error: "Label not found" };

    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { labels: { connect: { id: labelId } } },
      });

      await logActivity(tx, {
        ticketId,
        userId: session.user.id,
        action: "LABEL_ADDED",
        toValue: label.name,
      });

      return updated;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("addLabel error:", error);
    return { success: false, error: "Failed to add label" };
  }
}

export async function removeLabel(input: {
  ticketId: string;
  labelId: string;
}): Promise<Result<Ticket>> {
  try {
    const session = await getSession();
    const parsed = labelTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId, labelId } = parsed.data;

    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) return { success: false, error: "Label not found" };

    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { labels: { disconnect: { id: labelId } } },
      });

      await logActivity(tx, {
        ticketId,
        userId: session.user.id,
        action: "LABEL_REMOVED",
        fromValue: label.name,
      });

      return updated;
    });

    return { success: true, data: ticket };
  } catch (error) {
    console.error("removeLabel error:", error);
    return { success: false, error: "Failed to remove label" };
  }
}

export async function deleteTicket(input: {
  ticketId: string;
}): Promise<Result<void>> {
  try {
    const session = await getSession();
    const parsed = deleteTicketSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { ticketId } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { createdById: true },
    });
    if (!ticket) return { success: false, error: "Ticket not found" };

    // Only ADMIN or the original creator can delete
    const isAdmin = session.user.role === Role.ADMIN;
    const isCreator = ticket.createdById === session.user.id;
    if (!isAdmin && !isCreator) {
      return { success: false, error: "You don't have permission to delete this ticket" };
    }

    await prisma.ticket.delete({ where: { id: ticketId } });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteTicket error:", error);
    return { success: false, error: "Failed to delete ticket" };
  }
}
