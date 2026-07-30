import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ExpensesClient } from "./ExpensesClient";

export const metadata = {
  title: "Project Expenses - IFlow",
};

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all active users for the dropdown and columns
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, avatarColor: true, role: true },
    orderBy: { displayName: "asc" },
  });

  // Fetch all expenses with splits
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      payer: { select: { displayName: true } },
      splits: true,
    },
  });

  return (
    <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar bg-background">
      <ExpensesClient
        expenses={expenses}
        allUsers={allUsers}
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </div>
  );
}
