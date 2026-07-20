"use client";

import { useState } from "react";
import { ChevronDown, Folder, Plus } from "lucide-react";
import type { Project } from "@prisma/client";
import { setProjectCookie } from "@/app/(app)/actions";
import { useRouter } from "next/navigation";
import { createProject } from "@/server/actions/project.actions";
import { Loader2 } from "lucide-react";

import { deleteProject } from "@/server/actions/project";
import { Trash2 } from "lucide-react";

export function ProjectSwitcher({
  projects,
  activeProject,
  collapsed,
  isAdmin,
}: {
  projects: Project[];
  activeProject: Project;
  collapsed: boolean;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSwitch(projectId: string) {
    await setProjectCookie(projectId);
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(projectId: string) {
    setIsSubmitting(true);
    const res = await deleteProject(projectId);
    if (res.success) {
      if (activeProject.id === projectId) {
        // Just let it refresh, or explicitly navigate away
        router.push("/overview");
      } else {
        router.refresh();
      }
    }
    setIsSubmitting(false);
    setIsDeleting(null);
    setOpen(false);
  }

  return (
    <div className="relative mb-4 px-3">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-2 rounded-lg bg-surface-elevated border border-surface-border hover:border-surface-border/80 transition-all ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center flex-shrink-0">
            <Folder size={14} />
          </div>
          {!collapsed && (
            <span className="text-sm font-medium text-text-primary truncate">
              {activeProject.name}
            </span>
          )}
        </div>
        {!collapsed && <ChevronDown size={14} className="text-text-secondary" />}
      </button>

      {open && !collapsed && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-3 right-3 mt-1 bg-surface-elevated border border-surface-border rounded-lg shadow-xl overflow-hidden z-20">
            <div className="max-h-60 overflow-y-auto p-1">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <button
                    onClick={() => handleSwitch(p.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      p.id === activeProject.id
                        ? "bg-[#5B5FEF]/15 text-[#5B5FEF] font-medium"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-border"
                    }`}
                  >
                    <span className="truncate block max-w-[150px]">{p.name}</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleting(p.id);
                      }}
                      className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="p-1 border-t border-surface-border">
                <button
                  onClick={() => {
                    setOpen(false);
                    setIsCreating(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#5B5FEF] hover:bg-[#5B5FEF]/15 transition-colors"
                >
                  <Plus size={14} />
                  Create Project
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h2 className="text-xl font-bold text-center text-text-primary mb-2">Delete Project?</h2>
            <p className="text-center text-sm text-text-secondary mb-6">
              Are you sure you want to delete this project? This action cannot be undone and all associated boards and tickets will be lost.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleting(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-text-secondary bg-surface-base border border-surface-border rounded-lg hover:bg-surface-border transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(isDeleting)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-destructive rounded-lg hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Create New Project</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                const formData = new FormData(e.currentTarget);
                const result = await createProject({
                  name: formData.get("name") as string,
                  description: formData.get("description") as string,
                });
                setIsSubmitting(false);
                if (result.success) {
                  setIsCreating(false);
                  handleSwitch(result.data.id);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                <input
                  name="name"
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-sm text-text-primary outline-none focus:border-[#5B5FEF]"
                  placeholder="e.g. Acme Website"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-sm text-text-primary outline-none focus:border-[#5B5FEF] resize-none"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
