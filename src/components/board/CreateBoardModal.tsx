"use client";

import { useState } from "react";
import { X, Loader2, Users } from "lucide-react";
import { createBoard } from "@/server/actions/board.actions";
import { useRouter } from "next/navigation";

interface CreateBoardModalProps {
  projectId: string;
  users: { id: string; displayName: string }[];
  onClose: () => void;
}

export function CreateBoardModal({ projectId, users, onClose }: CreateBoardModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const result = await createBoard({
      projectId,
      name: formData.get("name") as string,
      department: formData.get("department") as "DEV" | "DESIGN" | "MARKETING" | "GENERAL",
      description: formData.get("description") as string,
      memberIds: Array.from(selectedUsers),
    });

    setIsSubmitting(false);
    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-elevated border border-surface-border rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <h2 className="text-lg font-semibold text-text-primary">Create New Board</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {error && <div className="text-sm text-[#D1495B] p-2 bg-[#D1495B]/10 rounded">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
            <input
              name="name"
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-sm text-text-primary outline-none focus:border-[#5B5FEF]"
              placeholder="e.g. Frontend Team"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Department</label>
            <select
              name="department"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-sm text-text-primary outline-none focus:border-[#5B5FEF]"
            >
              <option value="DEV">Development</option>
              <option value="DESIGN">Design</option>
              <option value="MARKETING">Marketing</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Description (Optional)</label>
            <textarea
              name="description"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-sm text-text-primary outline-none focus:border-[#5B5FEF] resize-none"
              placeholder="What is this board for?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1">
              <Users size={12} /> Access List (Optional)
            </label>
            <div className="text-xs text-text-secondary mb-2">Select members who can see this board. Admins always have access.</div>
            <div className="grid grid-cols-2 gap-2">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-text-primary bg-surface-base p-2 rounded border border-surface-border cursor-pointer hover:border-[#5B5FEF]/50">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="accent-[#5B5FEF]"
                  />
                  {u.displayName}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-surface-border mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-[#5B5FEF] text-white rounded-lg hover:bg-[#4B4FE0] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Create Board
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
