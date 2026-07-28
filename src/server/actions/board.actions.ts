"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createBoardSchema,
  createColumnSchema,
  reorderColumnSchema,
} from "@/lib/validators";
import type { Board, Column } from "@prisma/client";
import { Role } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const DEFAULT_COLUMNS = [
  { name: "Backlog", order: 0 },
  { name: "To Do", order: 1 },
  { name: "In Progress", order: 2 },
  { name: "In Review", order: 3 },
  { name: "Done", order: 4 },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createBoard(input: {
  projectId: string;
  name: string;
  department: "DEV" | "DESIGN" | "MARKETING" | "GENERAL";
  description?: string;
  memberIds?: string[];
}): Promise<Result<Board>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER) {
      return { success: false, error: "Admin or Manager only" };
    }

    const parsed = createBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { projectId, name, department, description, memberIds = [] } = parsed.data;

    // Ensure unique slug
    let slug = slugify(name);
    const existing = await prisma.board.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const board = await prisma.board.create({
      data: {
        name,
        slug,
        projectId,
        department,
        description,
        columns: {
          create: DEFAULT_COLUMNS,
        },
        members: {
          connect: memberIds.map((id) => ({ id })),
        },
      },
    });

    return { success: true, data: board };
  } catch (error) {
    console.error("createBoard error:", error);
    return { success: false, error: "Failed to create board" };
  }
}

export async function createColumn(input: {
  boardId: string;
  name: string;
  wipLimit?: number;
}): Promise<Result<Column>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN) return { success: false, error: "Admin only" };

    const parsed = createColumnSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { boardId, name, wipLimit } = parsed.data;

    const maxOrder = await prisma.column.aggregate({
      where: { boardId },
      _max: { order: true },
    });
    const order = (maxOrder._max.order ?? -1) + 1;

    const column = await prisma.column.create({
      data: { boardId, name, order, wipLimit },
    });

    return { success: true, data: column };
  } catch (error) {
    console.error("createColumn error:", error);
    return { success: false, error: "Failed to create column" };
  }
}

export async function reorderColumn(input: {
  columnId: string;
  toOrder: number;
}): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN) return { success: false, error: "Admin only" };

    const parsed = reorderColumnSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { columnId, toOrder } = parsed.data;

    const column = await prisma.column.findUnique({ where: { id: columnId } });
    if (!column) return { success: false, error: "Column not found" };

    const fromOrder = column.order;

    // Shift other columns to make room
    if (fromOrder < toOrder) {
      await prisma.column.updateMany({
        where: {
          boardId: column.boardId,
          order: { gt: fromOrder, lte: toOrder },
          id: { not: columnId },
        },
        data: { order: { decrement: 1 } },
      });
    } else if (fromOrder > toOrder) {
      await prisma.column.updateMany({
        where: {
          boardId: column.boardId,
          order: { gte: toOrder, lt: fromOrder },
          id: { not: columnId },
        },
        data: { order: { increment: 1 } },
      });
    }

    await prisma.column.update({
      where: { id: columnId },
      data: { order: toOrder },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("reorderColumn error:", error);
    return { success: false, error: "Failed to reorder column" };
  }
}

export async function deleteBoard(boardId: string): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN) {
      return { success: false, error: "Admin only" };
    }

    await prisma.board.delete({
      where: { id: boardId },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteBoard error:", error);
    return { success: false, error: "Failed to delete board" };
  }
}
