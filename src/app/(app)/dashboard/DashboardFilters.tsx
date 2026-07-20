"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

interface DashboardFiltersProps {
  filterDept: string;
  filterPriority: string;
  filterAssignee: string;
  users: { id: string; displayName: string }[];
}

export function DashboardFilters({
  filterDept,
  filterPriority,
  filterAssignee,
  users,
}: DashboardFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const updateParam = (key: string, value: string) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(key, value);
      router.push(url.pathname + url.search);
    });
  };

  return (
    <form className="flex flex-wrap gap-3 mb-6">
      <select
        name="dept"
        defaultValue={filterDept}
        className="px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-elevated border border-surface-border outline-none"
        onChange={(e) => updateParam("dept", e.target.value)}
        aria-label="Filter by department"
      >
        <option value="all">All departments</option>
        <option value="DEV">Dev</option>
        <option value="DESIGN">Design</option>
        <option value="MARKETING">Marketing</option>
        <option value="GENERAL">General</option>
      </select>

      <select
        name="priority"
        defaultValue={filterPriority}
        className="px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-elevated border border-surface-border outline-none"
        onChange={(e) => updateParam("priority", e.target.value)}
        aria-label="Filter by priority"
      >
        <option value="all">All priorities</option>
        <option value="URGENT">Urgent</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      <select
        name="assignee"
        defaultValue={filterAssignee}
        className="px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-elevated border border-surface-border outline-none"
        onChange={(e) => updateParam("assignee", e.target.value)}
        aria-label="Filter by assignee"
      >
        <option value="all">All assignees</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
      {isPending && (
        <div className="flex items-center justify-center pl-2 text-[#5B5FEF]">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}
    </form>
  );
}
