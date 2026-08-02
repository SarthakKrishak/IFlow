"use client";

import { useState } from "react";
import { Book, Plus, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createNotebook } from "@/server/actions/wiki.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Notebook {
  id: string;
  title: string;
  updatedAt: Date;
  _count: { pages: number };
  createdBy: { displayName: string };
}

export default function WikiClient({
  initialNotebooks,
  projectId,
}: {
  initialNotebooks: Notebook[];
  projectId: string;
}) {
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const res = await createNotebook(projectId, newTitle);
    if (res.success && res.notebook) {
      toast.success("Notebook created");
      setIsCreating(false);
      setNewTitle("");
      router.refresh();
      router.push(`/wiki/${res.notebook.id}`);
    } else {
      toast.error(res.error || "Failed to create notebook");
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Wiki</h1>
          <p className="text-muted-foreground">Collaborative knowledge base for your team</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all"
        >
          <Plus size={18} />
          <span>New Notebook</span>
        </button>
      </div>

      {isCreating && (
        <div className="mb-8 p-6 rounded-2xl border border-surface-border bg-surface-elevated shadow-sm flex items-end gap-4 max-w-xl">
          <div className="flex-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Notebook Name</label>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Engineering Docs"
              className="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium">Create</button>
          </div>
        </div>
      )}

      {notebooks.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-surface-border rounded-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No notebooks yet</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            Create a notebook to start documenting your project. You can add pages and collaborate in real-time.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Create Notebook</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {notebooks.map((nb) => (
            <Link
              key={nb.id}
              href={`/wiki/${nb.id}`}
              className="group p-6 rounded-2xl border border-surface-border bg-surface-elevated hover:border-primary/50 transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Book size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-foreground">{nb.title}</h3>
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
                <span>{nb._count.pages} pages</span>
                <span className="flex items-center gap-1">
                  Updated {formatDistanceToNow(new Date(nb.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
