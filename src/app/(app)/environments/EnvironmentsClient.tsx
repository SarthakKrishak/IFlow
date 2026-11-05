"use client";

import { useState } from "react";
import { Plus, Server, Lock, KeyRound, Trash2, Users, Search, Loader2 } from "lucide-react";
import { Badge, Button, Dialog, EmptyState, Field, IconButton, Input, Select, useConfirm } from "@/components/ui";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEnvironment, deleteEnvironment, updateEnvironmentAccess } from "@/server/actions/environment.actions";

type UserBasic = { id: string, displayName: string, avatarColor: string };
type EnvironmentData = {
  id: string;
  name: string;
  createdAt: string;
  hasAccess: boolean;
  hasWriteAccess: boolean;
  project: { name: string };
  createdBy: UserBasic;
  allowedUsers: UserBasic[];
  writeUsers: UserBasic[];
  _count: { variables: number };
};

export function EnvironmentsClient({ 
  environments, 
  isAdmin,
  users,
  projects,
  currentUserId
}: { 
  environments: EnvironmentData[], 
  isAdmin: boolean,
  users: UserBasic[],
  projects: { id: string, name: string }[],
  currentUserId: string
}) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { confirm: ask, dialog: confirmDialog } = useConfirm();
  const [newName, setNewName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingEnvId, setLoadingEnvId] = useState<string | null>(null);
  
  const [selectedWriteUsers, setSelectedWriteUsers] = useState<string[]>([]);
  
  // Access Management State
  const [editingAccessEnv, setEditingAccessEnv] = useState<EnvironmentData | null>(null);
  const [editAccessUsers, setEditAccessUsers] = useState<string[]>([]);
  const [editWriteUsers, setEditWriteUsers] = useState<string[]>([]);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const handleCardClick = (env: EnvironmentData) => {
    if (!env.hasAccess) {
      toast.error("Access Denied", {
        description: "You are not authorized to view these ENV variables. Please contact an admin."
      });
      return;
    }

    setLoadingEnvId(env.id);
    router.push(`/environments/${env.id}`);
    // Safety: never leave the spinner stuck if navigation stalls
    setTimeout(() => {
      setLoadingEnvId((current) => (current === env.id ? null : current));
    }, 5000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !selectedProjectId) return;
    
    setIsSubmitting(true);
    try {
      await createEnvironment({
        name: newName,
        projectId: selectedProjectId,
        allowedUserIds: selectedUsers,
        writeUserIds: selectedWriteUsers
      });
      toast.success("Environment created");
      setIsModalOpen(false);
      setNewName("");
      setSelectedUsers([]);
      setSelectedWriteUsers([]);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create environment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!(await ask({ title: "Delete this environment?", description: "All of its variables will be permanently removed.", confirmLabel: "Delete environment", danger: true }))) return;
    try {
      await deleteEnvironment(id);
      toast.success("Environment deleted");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccessEnv) return;
    
    setIsUpdatingAccess(true);
    try {
      await updateEnvironmentAccess(editingAccessEnv.id, editAccessUsers, editWriteUsers);
      toast.success("Access updated successfully");
      setEditingAccessEnv(null);
      setEditAccessUsers([]);
      setEditWriteUsers([]);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const openEditAccess = (e: React.MouseEvent, env: EnvironmentData) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setEditingAccessEnv(env);
    setEditAccessUsers(env.allowedUsers.map(u => u.id));
    setEditWriteUsers(env.writeUsers.map(u => u.id));
  };

  const visible = environments.filter((e) => (e.name + " " + e.project.name).toLowerCase().includes(query.trim().toLowerCase()));

  const AccessPicker = ({
    label,
    selected,
    onChange,
    maxH = "max-h-44",
  }: {
    label: string;
    selected: string[];
    onChange: (ids: string[]) => void;
    maxH?: string;
  }) => (
    <div>
      <label className="block text-[12px] font-semibold text-foreground/80 mb-1.5">{label}</label>
      <div className={`bg-surface-base border border-surface-border rounded-xl ${maxH} overflow-y-auto custom-scrollbar p-1.5 space-y-0.5`}>
        {users.filter((u) => u.id !== currentUserId).map((user) => (
          <label key={user.id} className="flex items-center gap-2.5 px-2 h-8 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={selected.includes(user.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, user.id] : selected.filter((id) => id !== user.id))}
              className="w-4 h-4 accent-primary"
            />
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-semibold flex-shrink-0" style={{ backgroundColor: user.avatarColor }}>
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <span className="text-[13px] text-foreground truncate">{user.displayName}</span>
          </label>
        ))}
        {users.filter((u) => u.id !== currentUserId).length === 0 && <p className="text-[12.5px] text-muted-foreground p-2">No other users.</p>}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto space-y-5 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search environments…" className="pl-9" aria-label="Search environments" />
            </div>
            <span className="text-[12.5px] text-muted-foreground hidden sm:block">
              <b className="text-foreground tabular-nums">{environments.length}</b> environment{environments.length === 1 ? "" : "s"}
            </span>
            {isAdmin && (
              <Button variant="primary" className="ml-auto" onClick={() => setIsModalOpen(true)}>
                <Plus size={15} /> New environment
              </Button>
            )}
          </div>

          {environments.length === 0 ? (
            <EmptyState
              icon={<Server size={22} />}
              title="No environments yet"
              description="Environments store API keys and secrets securely, per project, with read and write access you control."
              action={isAdmin ? <Button variant="primary" onClick={() => setIsModalOpen(true)}><Plus size={15} /> Create environment</Button> : undefined}
            />
          ) : visible.length === 0 ? (
            <EmptyState icon={<Search size={22} />} title="No environments match" description={`Nothing matches “${query}”.`} action={<Button onClick={() => setQuery("")}>Clear search</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((env) => (
                <div
                  key={env.id}
                  onClick={() => handleCardClick(env)}
                  className={`surface-card p-5 transition-all group relative overflow-hidden cursor-pointer hover:shadow-md ${env.hasAccess ? "hover:border-primary/40" : "opacity-80"}`}
                >
                  {loadingEnvId === env.id && (
                    <div className="absolute inset-0 bg-surface-base/60 flex items-center justify-center z-20">
                      <Loader2 className="animate-spin text-primary" size={22} />
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-3 mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${env.hasAccess ? "bg-foreground/[0.06] text-foreground" : "bg-surface-border/60 text-muted-foreground"}`}>
                        {env.hasAccess ? <Server size={18} /> : <Lock size={18} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-foreground truncate">{env.name}</h3>
                        <p className="text-[12px] text-muted-foreground truncate">{env.project.name}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <IconButton label="Manage access" onClick={(e) => openEditAccess(e, env)}>
                          <Users size={15} />
                        </IconButton>
                        <IconButton label="Delete environment" onClick={(e) => handleDelete(e, env.id)} className="hover:!text-red-500">
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mb-5">
                    {env.hasAccess ? (
                      <Badge tone={env.hasWriteAccess ? "success" : "info"} dot>
                        {env.hasWriteAccess ? "Read & write" : "Read only"}
                      </Badge>
                    ) : (
                      <Badge tone="danger">
                        <Lock size={10} /> Restricted
                      </Badge>
                    )}
                    <Badge>
                      <KeyRound size={10} /> {env._count.variables} variable{env._count.variables === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0" style={{ backgroundColor: env.createdBy.avatarColor }}>
                        {env.createdBy.displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[12px] text-muted-foreground truncate">{env.createdBy.displayName}</span>
                    </div>
                    <div className="flex -space-x-2" title="Members with access">
                      {env.allowedUsers.slice(0, 3).map((u) => (
                        <span key={u.id} className="w-6 h-6 rounded-full border-2 border-surface-elevated flex items-center justify-center text-white text-[9px] font-semibold" style={{ backgroundColor: u.avatarColor }} title={u.displayName}>
                          {u.displayName.charAt(0).toUpperCase()}
                        </span>
                      ))}
                      {env.allowedUsers.length > 3 && (
                        <span className="w-6 h-6 rounded-full border-2 border-surface-elevated bg-surface-border text-foreground text-[9px] font-semibold flex items-center justify-center">+{env.allowedUsers.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDialog}
      {isModalOpen && (
        <Dialog
          title="Create environment"
          description="Secrets are encrypted. Admins always have full access."
          onClose={() => setIsModalOpen(false)}
          footer={
            <>
              <Button type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" form="create-env-form" variant="primary" loading={isSubmitting} disabled={!newName.trim() || !selectedProjectId}>
                Create environment
              </Button>
            </>
          }
        >
          <form id="create-env-form" onSubmit={handleCreate} className="space-y-4">
            <Field label="Name">
              <Input required autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Production, Staging" />
            </Field>
            <Field label="Project">
              <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AccessPicker label="Can view" selected={selectedUsers} onChange={setSelectedUsers} />
              <AccessPicker label="Can edit" selected={selectedWriteUsers} onChange={setSelectedWriteUsers} />
            </div>
          </form>
        </Dialog>
      )}

      {editingAccessEnv && (
        <Dialog
          title="Manage access"
          description={`Choose who can view and edit ${editingAccessEnv.name}.`}
          onClose={() => {
            setEditingAccessEnv(null);
            setEditAccessUsers([]);
            setEditWriteUsers([]);
          }}
          footer={
            <>
              <Button
                type="button"
                onClick={() => {
                  setEditingAccessEnv(null);
                  setEditAccessUsers([]);
                  setEditWriteUsers([]);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" form="edit-access-form" variant="primary" loading={isUpdatingAccess}>
                Save changes
              </Button>
            </>
          }
        >
          <form id="edit-access-form" onSubmit={handleUpdateAccess} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AccessPicker label="Can view" selected={editAccessUsers} onChange={setEditAccessUsers} maxH="max-h-64" />
            <AccessPicker label="Can edit" selected={editWriteUsers} onChange={setEditWriteUsers} maxH="max-h-64" />
          </form>
        </Dialog>
      )}
    </div>
  );
}
