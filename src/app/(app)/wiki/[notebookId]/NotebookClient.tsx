"use client";

import { useState } from "react";
import { FileText, Plus, ArrowLeft, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createPage, deletePage } from "@/server/actions/wiki.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Notebook, Page } from "@prisma/client";

type NotebookWithPages = Notebook & { pages: Page[] };

export default function NotebookClient({ notebook }: { notebook: NotebookWithPages }) {
  const [pages, setPages] = useState(notebook.pages);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const res = await createPage(notebook.id, newTitle);
    if (res.success && res.page) {
      toast.success("Page created");
      setIsCreating(false);
      setNewTitle("");
      router.refresh();
      router.push(`/wiki/${notebook.id}/${res.page.id}`);
    } else {
      toast.error(res.error || "Failed to create page");
    }
  };

  const handleDelete = async (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    if (!confirm("Delete this page?")) return;
    const res = await deletePage(pageId);
    if (res.success) {
      toast.success("Page deleted");
      setPages(pages.filter((p) => p.id !== pageId));
      router.refresh();
    } else {
      toast.error(res.error || "Failed to delete page");
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="mb-6">
        <Link href="/wiki" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft size={16} />
          <span>Back to Wiki</span>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{notebook.title}</h1>
            <p className="text-muted-foreground">Manage pages inside this notebook</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all"
          >
            <Plus size={18} />
            <span>New Page</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="mb-8 p-6 rounded-2xl border border-surface-border bg-surface-elevated shadow-sm flex items-end gap-4 max-w-xl">
          <div className="flex-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Page Title</label>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Q3 Roadmap"
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

      {pages.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-surface-border rounded-2xl mt-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No pages yet</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            Create a page to start collaborating on documents.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Create Page</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-8">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={`/wiki/${notebook.id}/${page.id}`}
              className="group flex items-center justify-between p-4 rounded-xl border border-surface-border bg-surface-elevated hover:border-primary/50 transition-all hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface-base border border-surface-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{page.title}</h3>
                  <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDelete(e, page.id)}
                  className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Page"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
