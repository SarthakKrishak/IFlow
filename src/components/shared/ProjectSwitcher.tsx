"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Folder, Plus, Trash2 } from "lucide-react";
import type { Project } from "@prisma/client";
import { setProjectCookie } from "@/app/(app)/actions";
import { useRouter } from "next/navigation";
import { createProject } from "@/server/actions/project.actions";
import { deleteProject } from "@/server/actions/project";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

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
    try {
      const res = await deleteProject(projectId);
      if (res.success) {
        if (activeProject.id === projectId) {
          router.push("/overview");
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.error || "Failed to delete project");
      }
    } catch (error) {
      console.error("Delete project failed:", error);
      toast.error("Network error — couldn't delete project");
    }
    setIsSubmitting(false);
    setIsDeleting(null);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between gap-2 h-9 px-2 rounded-lg bg-surface-elevated border border-surface-border hover:border-foreground/20 transition-colors",
          collapsed && "justify-center px-0"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={collapsed ? activeProject.name : undefined}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-5 h-5 rounded bg-foreground text-background flex items-center justify-center flex-shrink-0 text-[10.5px] font-semibold uppercase">
            {activeProject.name.trim().charAt(0) || <Folder size={11} />}
          </div>
          {!collapsed && <span className="text-[13px] font-medium text-foreground truncate">{activeProject.name}</span>}
        </div>
        {!collapsed && <ChevronsUpDown size={13} className="text-muted-foreground shrink-0" />}
      </button>

      {open && !collapsed && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-lg shadow-pop overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-150">
            <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-medium text-muted-foreground">Projects</p>
            <div className="max-h-60 overflow-y-auto p-1">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between group">
                  <button
                    onClick={() => handleSwitch(p.id)}
                    className={cn(
                      "flex-1 flex items-center justify-between gap-2 text-left px-2 h-8 rounded-md text-[13px] transition-colors",
                      p.id === activeProject.id
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProject.id && <Check size={13} className="shrink-0" />}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleting(p.id);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete project"
                      aria-label={`Delete project ${p.name}`}
                    >
                      <Trash2 size={13} />
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
                  className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={14} />
                  Create project
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {isDeleting && (
        <Dialog
          size="sm"
          title="Delete project?"
          description="This can’t be undone. All boards and tickets in it will be lost."
          onClose={() => setIsDeleting(null)}
          footer={
            <>
              <Button onClick={() => setIsDeleting(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" className="!bg-red-600 hover:!bg-red-700 !text-white" loading={isSubmitting} onClick={() => handleDelete(isDeleting)}>
                Delete project
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
              <Trash2 size={18} />
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pt-1">
              You are about to permanently delete <b className="text-foreground">{projects.find((p) => p.id === isDeleting)?.name}</b>.
            </p>
          </div>
        </Dialog>
      )}

      {isCreating && (
        <Dialog title="Create project" description="Projects group boards, wiki notebooks and the Page Tracker." onClose={() => setIsCreating(false)}>
          <form
            id="create-project-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const formData = new FormData(e.currentTarget);
                const result = await createProject({
                  name: formData.get("name") as string,
                  description: formData.get("description") as string,
                });
                setIsSubmitting(false);
                if (result.success) {
                  setIsCreating(false);
                  handleSwitch(result.data.id);
                } else {
                  toast.error(result.error || "Failed to create project");
                }
              } catch (error) {
                console.error("Create project failed:", error);
                setIsSubmitting(false);
                toast.error("Network error — couldn't create project");
              }
            }}
            className="space-y-4"
          >
            <Field label="Name">
              <Input name="name" required autoFocus placeholder="e.g. Acme Website" />
            </Field>
            <Field label="Description" hint="Optional">
              <Textarea name="description" rows={3} placeholder="What is this project about?" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setIsCreating(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Create project
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
