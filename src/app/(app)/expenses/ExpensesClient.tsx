"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense, toggleSplitPaid } from "@/server/actions/expense.actions";
import type { Expense, ExpenseSplit, User } from "@prisma/client";
import { Loader2, Plus, Trash2, Users, CheckSquare, Square, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, IconButton, Input, Progress, SectionLabel, Select, StatCard, StatGroup, Toolbar, useConfirm } from "@/components/ui";
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
  const [localExpenses, setLocalExpenses] = useState<ExpenseWithSplits[]>(expenses);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const { confirm: ask, dialog: confirmDialog } = useConfirm();

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [payerId, setPayerId] = useState(currentUserId);
  const [involvedUserIds, setInvolvedUserIds] = useState<Set<string>>(new Set());

  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";
  const teamMembers = allUsers.filter((u) => u.role !== "ADMIN");
  // Default the payer away from an admin account (admins don't take part in splits)
  useEffect(() => {
    if (currentUserRole === "ADMIN" && teamMembers.length > 0) {
      setPayerId((prev) => (prev === currentUserId ? teamMembers[0].id : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserRole, currentUserId]);

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
      setLocalExpenses([result.data, ...localExpenses]);
      setIsFormExpanded(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!(await ask({ title: "Delete this expense?", description: "Its splits are removed from everyone’s totals.", confirmLabel: "Delete expense", danger: true }))) return;
    setIsDeleting(expenseId);
    const result = await deleteExpense({ expenseId });
    if (result.success) {
      toast.success("Expense deleted");
      setLocalExpenses(localExpenses.filter(e => e.id !== expenseId));
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsDeleting(null);
  };

  const handleTogglePaid = async (splitId: string, currentStatus: boolean) => {
    // Snapshot for a correct revert (functional updates avoid stale closures)
    let snapshot: ExpenseWithSplits[] = [];
    setLocalExpenses((prev) => {
      snapshot = prev;
      return prev.map(expense => {
        const splitIndex = expense.splits.findIndex(s => s.id === splitId);
        if (splitIndex !== -1) {
          const newSplits = [...expense.splits];
          newSplits[splitIndex] = { ...newSplits[splitIndex], isPaid: !currentStatus };
          return { ...expense, splits: newSplits };
        }
        return expense;
      });
    });

    const result = await toggleSplitPaid({ splitId, isPaid: !currentStatus });
    if (!result.success) {
      toast.error(result.error);
      // Revert if failed
      setLocalExpenses(snapshot);
    }
  };

  // Calculate totals
  const totalProjectSpend = localExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const totals: Record<string, number> = {};
  teamMembers.forEach((m) => {
    totals[m.id] = 0;
  });

  localExpenses.forEach((expense) => {
    expense.splits.forEach((split) => {
      if (totals[split.userId] !== undefined && !split.isPaid) {
        totals[split.userId] += split.amountOwed;
      }
    });
  });

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalOutstanding = Object.values(totals).reduce((a, b) => a + b, 0);
  const paidShare = totalProjectSpend > 0 ? Math.round(((totalProjectSpend - totalOutstanding) / totalProjectSpend) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12 animate-fade-in">
      <Toolbar title="Shared expenses" description="Log what the team spends and track who has settled their share.">
        {canEdit && (
          <Button variant="primary" onClick={() => setIsFormExpanded(true)}>
            <Plus size={15} /> Add expense
          </Button>
        )}
      </Toolbar>

      <StatGroup className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Total project spend" value={`₹${fmt(totalProjectSpend)}`} tone="primary" icon={<Wallet size={15} />} hint={`${localExpenses.length} expense${localExpenses.length === 1 ? "" : "s"} logged`} />
        <StatCard label="Still owed" value={`₹${fmt(totalOutstanding)}`} tone={totalOutstanding > 0 ? "warning" : "success"} icon={<Users size={15} />} hint="Unpaid shares across the team" />
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Settled</SectionLabel>
            <span className="text-[12.5px] font-semibold tabular-nums">{paidShare}%</span>
          </div>
          <Progress value={paidShare} tone="success" className="mt-4" />
          <p className="text-[12px] text-muted-foreground mt-3">Share of total spend that has been paid back</p>
        </Card>
      </StatGroup>

      <Card className="overflow-hidden">
        <CardHeader title="Split tracker" description="Tick a share when it has been paid" icon={<Users size={16} />} />
        {localExpenses.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Wallet size={22} />}
              title="No expenses logged yet"
              description={canEdit ? "Add the first shared expense to start tracking who owes what." : "A manager or admin logs the team’s shared expenses."}
              action={canEdit ? <Button variant="primary" onClick={() => setIsFormExpanded(true)}><Plus size={15} /> Add expense</Button> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-5 py-3"><SectionLabel>Expense</SectionLabel></th>
                  <th className="px-5 py-3"><SectionLabel>Total</SectionLabel></th>
                  <th className="px-5 py-3"><SectionLabel>Paid by</SectionLabel></th>
                  {teamMembers.map((m) => (
                    <th key={m.id} className="px-5 py-3">
                      <div className="flex items-center gap-1.5 normal-case">
                        <Avatar displayName={m.displayName} avatarColor={m.avatarColor} size="sm" />
                        <span className="text-[12px] font-semibold text-muted-foreground">{m.displayName}</span>
                      </div>
                    </th>
                  ))}
                  {canEdit && <th className="px-5 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {localExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{expense.name}</p>
                      <p className="text-[12px] text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums">₹{expense.amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{expense.payer.displayName}</td>
                    {teamMembers.map((m) => {
                      const split = expense.splits.find((sp) => sp.userId === m.id);
                      return (
                        <td key={m.id} className="px-5 py-3">
                          {split ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTogglePaid(split.id, split.isPaid)}
                                disabled={!canEdit}
                                className={`flex-shrink-0 transition-colors ${canEdit ? "cursor-pointer" : "cursor-default opacity-70"} ${split.isPaid ? "text-emerald-500" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
                                aria-label={split.isPaid ? "Mark as unpaid" : "Mark as paid"}
                              >
                                {split.isPaid ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <span className={`font-mono font-medium tabular-nums ${split.isPaid ? "text-muted-foreground/60 line-through" : "text-foreground"}`}>₹{split.amountOwed.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <IconButton label="Delete expense" onClick={() => handleDeleteExpense(expense.id)} disabled={isDeleting === expense.id} className="hover:!text-red-500">
                          {isDeleting === expense.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </IconButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-base/60 border-t border-surface-border">
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-right"><SectionLabel>Total owed</SectionLabel></td>
                  {teamMembers.map((m) => (
                    <td key={m.id} className="px-5 py-4">
                      <Badge tone={totals[m.id] > 0 ? "warning" : "success"} className="!h-6 !text-[12px] tabular-nums">
                        ₹{fmt(totals[m.id])}
                      </Badge>
                    </td>
                  ))}
                  {canEdit && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {confirmDialog}
      {isFormExpanded && (
        <Dialog
          size="lg"
          title="Add expense"
          description="The amount is split equally among the people you select."
          onClose={() => !isSubmitting && setIsFormExpanded(false)}
          footer={
            <>
              <Button onClick={() => setIsFormExpanded(false)} disabled={isSubmitting}>Cancel</Button>
              <Button variant="primary" form="add-expense-form" type="submit" loading={isSubmitting}>Add expense</Button>
            </>
          }
        >
          <form id="add-expense-form" onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Expense name" className="md:col-span-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Team dinner, subscription" autoFocus />
              </Field>
              <Field label="Amount (₹)">
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Paid by">
              <Select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="md:max-w-xs">
                {teamMembers.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </Select>
            </Field>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-semibold text-foreground/80">Split among</label>
                <button type="button" onClick={handleSelectAll} className="text-[12px] font-semibold text-primary hover:underline">
                  {involvedUserIds.size === teamMembers.length ? "Deselect all" : "Select all"}
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
                      aria-pressed={isSelected}
                      className={`flex items-center gap-2 pl-1.5 pr-3 h-9 rounded-full border text-[13px] font-medium transition-colors ${
                        isSelected ? "border-foreground/25 bg-surface-hover text-foreground" : "border-surface-border bg-surface-base text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      <Avatar displayName={member.displayName} avatarColor={member.avatarColor} size="sm" />
                      {member.displayName}
                    </button>
                  );
                })}
              </div>
              {involvedUserIds.size > 0 && amount && (
                <p className="text-[12px] text-muted-foreground mt-2.5">
                  ₹{fmt((parseFloat(amount) || 0) / involvedUserIds.size)} each · {involvedUserIds.size} {involvedUserIds.size === 1 ? "person" : "people"}
                </p>
              )}
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
