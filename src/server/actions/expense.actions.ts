"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

const createExpenseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  amount: z.number().positive("Amount must be positive").max(100000000),
  date: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date"),
  payerId: z.string().cuid("Invalid payer"),
  involvedUserIds: z.array(z.string().cuid()).min(1, "At least one person must be involved").max(50),
});

export async function createExpense(input: {
  name: string;
  amount: number;
  date: string;
  payerId: string;
  involvedUserIds: string[];
}): Promise<Result<any>> {
  try {
    const session = await getSession();
    
    // Only Admin or Manager can create expenses
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER) {
      return { success: false, error: "Only admins or managers can add expenses" };
    }

    const parsed = createExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { name, amount, date, payerId, involvedUserIds } = parsed.data;

    // Verify payer + involved users exist
    const uniqueIds = Array.from(new Set([payerId, ...involvedUserIds]));
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (existingUsers.length !== uniqueIds.length) {
      return { success: false, error: "One or more selected users no longer exist" };
    }

    // Split to paise so the parts always sum back to the exact total
    const totalPaise = Math.round(amount * 100);
    const n = involvedUserIds.length;
    const basePaise = Math.floor(totalPaise / n);
    let remainder = totalPaise - basePaise * n;
    const splitAmounts = involvedUserIds.map(() => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return (basePaise + extra) / 100;
    });

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          name,
          amount,
          date: new Date(date),
          payerId,
          splits: {
            create: involvedUserIds.map((userId, i) => ({
              userId,
              amountOwed: splitAmounts[i],
            })),
          },
        },
        include: {
          splits: true,
          payer: { select: { displayName: true } }
        }
      });
      return exp;
    });

    return { success: true, data: expense };
  } catch (error) {
    console.error("createExpense error:", error);
    return { success: false, error: "Failed to create expense" };
  }
}

export async function deleteExpense(input: { expenseId: string }): Promise<Result<void>> {
  try {
    const session = await getSession();
    
    // Only Admin or Manager can delete expenses
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER) {
      return { success: false, error: "Only admins or managers can delete expenses" };
    }

    if (!input.expenseId) return { success: false, error: "Expense ID required" };

    await prisma.expense.delete({
      where: { id: input.expenseId }
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteExpense error:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}

export async function toggleSplitPaid(input: { splitId: string; isPaid: boolean }): Promise<Result<void>> {
  try {
    const session = await getSession();
    
    // Only Admin or Manager can mark splits as paid
    if (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER) {
      return { success: false, error: "Only admins or managers can update payment status" };
    }

    if (!input.splitId) return { success: false, error: "Split ID required" };

    await prisma.expenseSplit.update({
      where: { id: input.splitId },
      data: { isPaid: input.isPaid }
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("toggleSplitPaid error:", error);
    return { success: false, error: "Failed to update payment status" };
  }
}
