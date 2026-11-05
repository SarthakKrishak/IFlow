"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { createBoard } from "@/server/actions/board.actions";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";

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
    const next = new Set(selectedUsers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedUsers(next);
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
    <Dialog
      title="Create board"
      description="Boards hold the columns and tickets for one team or workstream."
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-board-form" variant="primary" loading={isSubmitting}>
            Create board
          </Button>
        </>
      }
    >
      <form id="create-board-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-[13px] text-red-500 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">{error}</div>}

        <Field label="Name">
          <Input name="name" required autoFocus placeholder="e.g. Frontend Team" />
        </Field>

        <Field label="Department">
          <Select name="department" required defaultValue="DEV">
            <option value="DEV">Development</option>
            <option value="DESIGN">Design</option>
            <option value="MARKETING">Marketing</option>
            <option value="GENERAL">General</option>
          </Select>
        </Field>

        <Field label="Description" hint="Optional">
          <Textarea name="description" rows={2} placeholder="What is this board for?" />
        </Field>

        <div>
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/80 mb-1">
            <Users size={13} /> Who can see it
          </label>
          <p className="text-[12px] text-muted-foreground mb-2">Select members with access. Admins always have access.</p>
          <div className="grid grid-cols-2 gap-2">
            {users.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-2 text-[13px] px-3 h-9 rounded-xl border cursor-pointer transition-colors ${
                  selectedUsers.has(u.id) ? "border-primary/50 bg-primary/5 text-foreground" : "border-surface-border bg-surface-base text-foreground/90 hover:border-muted-foreground/40"
                }`}
              >
                <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleUser(u.id)} className="accent-primary" />
                <span className="truncate">{u.displayName}</span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
