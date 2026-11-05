"use client";

import { useState } from "react";
import { Book, Plus, BookOpen, Loader2, Trash2, Search } from "lucide-react";
import { Button, Dialog, EmptyState, IconButton, Input, useConfirm } from "@/components/ui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createNotebook, deleteNotebook } from "@/server/actions/wiki.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Notebook } from "@prisma/client";

export default function WikiClient({
  initialNotebooks,
  projectId,
}: {
  initialNotebooks: (Notebook & { createdBy: { displayName: string } })[];
  projectId: string;
}) {
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [query, setQuery] = useState("");
  const { confirm: ask, dialog: confirmDialog } = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!newTitle.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Create temporary optimistic notebook
    const tempId = `temp-${Date.now()}`;
    const optimisticNotebook = {
      id: tempId,
      title: newTitle,
      content: "",
      projectId,
      createdById: "me",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: { displayName: "You" }
    };
    
    setNotebooks((prev) => [optimisticNotebook, ...prev]);

    try {
      const res = await createNotebook(projectId, newTitle);

      if (res.success && res.notebook) {
        // Replace optimistic notebook with actual
        setNotebooks((prev) => prev.map(nb => nb.id === tempId ? { ...res.notebook, createdBy: { displayName: "You" } } : nb));
        toast.success("Notebook created");
        setIsCreating(false);
        setNewTitle("");
        setIsSubmitting(false);
        router.refresh();
        // Immediately navigate to the new notebook
        router.push(`/wiki/${res.notebook.id}`);
      } else {
        setNotebooks((prev) => prev.filter(nb => nb.id !== tempId)); // revert
        setIsSubmitting(false);
        toast.error(res.error || "Failed to create notebook");
      }
    } catch (error) {
      console.error("Create notebook failed:", error);
      setNotebooks((prev) => prev.filter(nb => nb.id !== tempId));
      setIsSubmitting(false);
      toast.error("Network error — couldn't create notebook");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!(await ask({ title: "Delete this notebook?", description: "Everything written in it will be lost.", confirmLabel: "Delete notebook", danger: true }))) return;
    
    const prev = [...notebooks];
    setNotebooks(notebooks.filter(nb => nb.id !== id));

    try {
      const res = await deleteNotebook(id);
      if (res.success) {
        toast.success("Notebook deleted");
        router.refresh();
      } else {
        setNotebooks(prev);
        toast.error("Failed to delete notebook");
      }
    } catch (error) {
      console.error("Delete notebook failed:", error);
      setNotebooks(prev);
      toast.error("Network error — couldn't delete notebook");
    }
  };

  const visible = notebooks.filter((nb) => nb.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notebooks…" className="pl-9" aria-label="Search notebooks" />
          </div>
          <span className="text-[12.5px] text-muted-foreground hidden sm:block">
            <b className="text-foreground tabular-nums">{notebooks.length}</b> notebook{notebooks.length === 1 ? "" : "s"}
          </span>
          <Button variant="primary" className="ml-auto" onClick={() => setIsCreating(true)}>
            <Plus size={15} /> New notebook
          </Button>
        </div>

        {notebooks.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="No notebooks yet"
            description="Create a notebook to document your project. Everyone on the team can edit it together in real time."
            action={
              <Button variant="primary" onClick={() => setIsCreating(true)}>
                <Plus size={15} /> Create notebook
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={<Search size={22} />} title="No notebooks match" description={`Nothing matches “${query}”.`} action={<Button onClick={() => setQuery("")}>Clear search</Button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((nb) => {
              const pending = nb.id.startsWith("temp");
              return (
                <Link
                  key={nb.id}
                  href={`/wiki/${nb.id}`}
                  className="surface-card group p-5 hover:border-foreground/20 hover:shadow-md transition-all flex flex-col min-h-[150px]"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-10 h-10 bg-foreground/[0.06] text-foreground rounded-xl flex items-center justify-center">
                      {pending ? <Loader2 size={19} className="animate-spin" /> : <Book size={19} />}
                    </div>
                    {!pending && (
                      <IconButton
                        label={`Delete ${nb.title}`}
                        onClick={(e) => handleDelete(e, nb.id)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:!text-red-500"
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </div>
                  <h3 className="font-semibold text-[15px] tracking-tight text-foreground line-clamp-2">{nb.title}</h3>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground mt-auto pt-4 gap-2">
                    <span className="truncate">{nb.createdBy.displayName}</span>
                    <span className="flex-shrink-0">{formatDistanceToNow(new Date(nb.updatedAt), { addSuffix: true })}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {confirmDialog}
      {isCreating && (
        <Dialog
          size="sm"
          title="New notebook"
          description="Give it a clear name — you can rename it later."
          onClose={() => !isSubmitting && setIsCreating(false)}
          footer={
            <>
              <Button onClick={() => setIsCreating(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" loading={isSubmitting} disabled={!newTitle.trim()} onClick={handleCreate}>
                Create notebook
              </Button>
            </>
          }
        >
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Engineering docs"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            disabled={isSubmitting}
            aria-label="Notebook name"
          />
        </Dialog>
      )}
    </div>
  );
}
