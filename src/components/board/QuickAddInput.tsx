"use client";

import { useState, useRef, useEffect } from "react";
import { createTicket } from "@/server/actions/ticket.actions";
import { useUIStore } from "@/stores/ui.store";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface QuickAddInputProps {
  boardId: string;
  columnId: string;
  onClose: () => void;
}

export function QuickAddInput({ boardId, columnId, onClose }: QuickAddInputProps) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setOpenTicketId } = useUIStore();
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);

    const result = await createTicket({
      boardId,
      columnId,
      title: title.trim(),
    });

    if (result.success) {
      toast.success("Ticket created");
      router.refresh();
      setOpenTicketId(result.data.id);
      onClose();
    } else {
      toast.error("Failed to create ticket");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="rounded-lg p-2 bg-surface-base border border-[#5B5FEF]/40">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!title.trim()) onClose();
        }}
        placeholder="Ticket title… press Enter to create"
        className="w-full bg-transparent text-sm text-text-primary placeholder-muted-foreground outline-none"
        disabled={isSubmitting}
        aria-label="New ticket title"
      />
      {isSubmitting && (
        <div className="flex justify-end mt-1">
          <Loader2 size={12} className="animate-spin text-[#5B5FEF]" />
        </div>
      )}
    </div>
  );
}
