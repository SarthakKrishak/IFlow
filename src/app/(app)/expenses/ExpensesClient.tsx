"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense } from "@/server/actions/expense.actions";
import type { Expense, ExpenseSplit, User } from "@prisma/client";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared";

type ExpenseWithSplits = Expense & {
  payer: Pick<User, "displayName">;
  splits: ExpenseSplit[];
};

interface ExpensesClientProps {
  expenses: ExpenseWithSplits[];
  allUsers: Pick<User, "id" | "displayName" | "avatarColor" | "role">[];
  currentUserId: string;
  currentUserRole: string;
}

export function ExpensesClient({ expenses, allUsers, currentUserId, currentUserRole }: ExpensesClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [payerId, setPayerId] = useState(currentUserId);
  const [involvedUserIds, setInvolvedUserIds] = useState<Set<string>>(new Set());

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";
  const teamMembers = allUsers.filter((u) => u.role !== "ADMIN");

  const handleToggleInvolved = (userId: string) => {
    setInvolvedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (involvedUserIds.size === teamMembers.length) {
      setInvolvedUserIds(new Set());
    } else {
      setInvolvedUserIds(new Set(teamMembers.map((m) => m.id)));
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !date || !payerId || involvedUserIds.size === 0) {
      toast.error("Please fill all fields and select at least one person.");
      return;
    }

    setIsSubmitting(true);
    const result = await createExpense({
      name,
      amount: parseFloat(amount),
      date: new Date(date).toISOString(),
      payerId,
      involvedUserIds: Array.from(involvedUserIds),
    });

    if (result.success) {
      toast.success("Expense added successfully");
      setName("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setInvolvedUserIds(new Set());
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setIsDeleting(expenseId);
    const result = await deleteExpense({ expenseId });
    if (result.success) {
      toast.success("Expense deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsDeleting(null);
  };

  // Calculate totals
  const totals: Record<string, number> = {};
  teamMembers.forEach((m) => {
    totals[m.id] = 0;
  });

  expenses.forEach((expense) => {
    expense.splits.forEach((split) => {
      if (totals[split.userId] !== undefined) {
        totals[split.userId] += split.amountOwed;
      }
    });
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Users className="text-primary" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Price Tracker</h1>
          <p className="text-sm text-text-secondary">Track team expenses and shared splits</p>
        </div>
      </div>

      {canEdit && (
        <div className="bg-surface-elevated rounded-3xl p-6 border border-surface-border shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Add New Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Expense Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dinner, Subscription"
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-surface-border text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-surface-border text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-base border border-surface-border text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Paid By</label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full md:w-1/4 px-3 py-2 rounded-xl bg-surface-base border border-surface-border text-sm outline-none focus:border-primary transition-colors"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id} style={{ background: "hsl(var(--surface-base))" }}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Split Among (Auto equally split)</label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {involvedUserIds.size === teamMembers.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member) => {
                  const isSelected = involvedUserIds.has(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleInvolved(member.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-surface-border bg-surface-base text-text-secondary hover:border-text-secondary/30"
                      }`}
                    >
                      <Avatar displayName={member.displayName} avatarColor={member.avatarColor} size="sm" />
                      <span className="font-medium">{member.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add Expense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Split Tracker Table */}
      <div className="bg-surface-elevated rounded-3xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Split Tracker</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-surface-border bg-surface-base/50">
                <th className="px-5 py-3 font-medium text-text-secondary uppercase tracking-wider text-xs">Event Name</th>
                <th className="px-5 py-3 font-medium text-text-secondary uppercase tracking-wider text-xs">Total Amount</th>
                <th className="px-5 py-3 font-medium text-text-secondary uppercase tracking-wider text-xs">Paid By</th>
                {teamMembers.map((m) => (
                  <th key={m.id} className="px-5 py-3 font-medium text-text-secondary uppercase tracking-wider text-xs">
                    <div className="flex items-center gap-1.5">
                      <Avatar displayName={m.displayName} avatarColor={m.avatarColor} size="sm" />
                      {m.displayName}
                    </div>
                  </th>
                ))}
                {canEdit && <th className="px-5 py-3 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={teamMembers.length + 4} className="px-5 py-8 text-center text-text-secondary">
                    No expenses logged yet.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-base/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-primary">{expense.name}</p>
                      <p className="text-xs text-text-secondary">{new Date(expense.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-text-primary">₹{expense.amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-text-secondary">{expense.payer.displayName}</td>
                    {teamMembers.map((m) => {
                      const split = expense.splits.find((s) => s.userId === m.id);
                      return (
                        <td key={m.id} className="px-5 py-3">
                          {split ? (
                            <span className="font-mono text-text-primary font-medium">₹{split.amountOwed.toFixed(2)}</span>
                          ) : (
                            <span className="text-text-secondary/50">-</span>
                          )}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          disabled={isDeleting === expense.id}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          {isDeleting === expense.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* Footer with totals */}
            {expenses.length > 0 && (
              <tfoot className="bg-surface-base border-t-2 border-surface-border">
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-right font-semibold text-text-primary uppercase tracking-wider text-xs">
                    Total Amount Owed:
                  </td>
                  {teamMembers.map((m) => (
                    <td key={m.id} className="px-5 py-4 font-mono font-bold text-primary">
                      ₹{totals[m.id].toFixed(2)}
                    </td>
                  ))}
                  {canEdit && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
