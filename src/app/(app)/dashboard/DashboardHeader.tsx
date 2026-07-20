"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CreateBoardModal } from "@/components/board/CreateBoardModal";
import type { Board } from "@prisma/client";

interface DashboardHeaderProps {
  boards: Pick<Board, "id" | "name">[];
  projectId: string;
  users: { id: string; displayName: string }[];
  isAdmin: boolean;
}

export function DashboardHeader({ boards, projectId, users, isAdmin }: DashboardHeaderProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-0.5">All tickets across your boards</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/board/${b.id}`}
            className="px-3 py-1.5 rounded-2xl text-sm text-text-secondary bg-surface-elevated border border-surface-border hover:text-text-primary hover:border-[#5B5FEF]/50 transition-all"
          >
            {b.name}
          </Link>
        ))}

        {isAdmin && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm text-[#5B5FEF] bg-[#5B5FEF]/10 border border-[#5B5FEF]/20 hover:bg-[#5B5FEF]/20 transition-all font-medium"
          >
            <Plus size={14} />
            New Board
          </button>
        )}
      </div>

      {isCreating && (
        <CreateBoardModal
          projectId={projectId}
          users={users}
          onClose={() => setIsCreating(false)}
        />
      )}
    </div>
  );
}
