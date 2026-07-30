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
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  date: z.string(), // ISO string
  payerId: z.string().min(1, "Payer is required"),
  involvedUserIds: z.array(z.string()).min(1, "At least one person must be involved"),
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

    const splitAmount = amount / involvedUserIds.length;

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          name,
          amount,
          date: new Date(date),
          payerId,
          splits: {
            create: involvedUserIds.map((userId) => ({
              userId,
              amountOwed: splitAmount,
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
