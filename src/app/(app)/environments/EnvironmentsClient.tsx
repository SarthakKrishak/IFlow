"use client";

import { useState } from "react";
import { Plus, Server, Lock, ShieldAlert, KeyRound, CalendarDays, MoreVertical, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEnvironment, deleteEnvironment, updateEnvironmentAccess } from "@/server/actions/environment.actions";

type UserBasic = { id: string, displayName: string, avatarColor: string };
type EnvironmentData = {
  id: string;
  name: string;
  createdAt: string;
  hasAccess: boolean;
  project: { name: string };
  createdBy: UserBasic;
  allowedUsers: UserBasic[];
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
  const [newName, setNewName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingEnvId, setLoadingEnvId] = useState<string | null>(null);
  
  // Access Management State
  const [editingAccessEnv, setEditingAccessEnv] = useState<EnvironmentData | null>(null);
  const [editAccessUsers, setEditAccessUsers] = useState<string[]>([]);
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
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !selectedProjectId) return;
    
    setIsSubmitting(true);
    try {
      await createEnvironment({
        name: newName,
        projectId: selectedProjectId,
        allowedUserIds: selectedUsers
      });
      toast.success("Environment created");
      setIsModalOpen(false);
      setNewName("");
      setSelectedUsers([]);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create environment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this environment?")) return;
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
      await updateEnvironmentAccess(editingAccessEnv.id, editAccessUsers);
      toast.success("Access updated successfully");
      setEditingAccessEnv(null);
      setEditAccessUsers([]);
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
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface-base">
      <header className="px-8 py-4 flex items-center justify-end shrink-0">
        {isAdmin && (
          <button 
            className="bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm flex items-center gap-2"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            New Environment
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {environments.map((env) => (
            <div 
              key={env.id} 
              onClick={() => handleCardClick(env)}
              className="bg-surface-elevated border border-surface-border rounded-2xl p-6 hover:border-[#5B5FEF]/50 transition-all cursor-pointer group hover:shadow-lg relative overflow-hidden"
            >
              {!env.hasAccess && (
                <div className="absolute inset-0 bg-surface-base/40 backdrop-blur-[1px] flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-red-500/10 text-red-500 px-4 py-2 rounded-full font-bold flex items-center gap-2 border border-red-500/20 shadow-xl backdrop-blur-md">
                    <Lock size={16} /> Restricted Access
                  </div>
                </div>
              )}
              
              {loadingEnvId === env.id && (
                <div className="absolute inset-0 bg-surface-base/50 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="w-8 h-8 border-4 border-[#5B5FEF] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{env.project.name}</span>
                    {!env.hasAccess && <Lock size={12} className="text-muted-foreground" />}
                  </div>
                  <h3 className="text-xl font-bold text-text-primary group-hover:text-[#5B5FEF] transition-colors">{env.name}</h3>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className="text-muted-foreground hover:text-[#5B5FEF] p-2 rounded-lg hover:bg-[#5B5FEF]/10 flex items-center gap-1 text-xs font-semibold"
                      onClick={(e) => openEditAccess(e, env)}
                      title="Manage Access"
                    >
                      <Users size={16} /> Access
                    </button>
                    <button 
                      className="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10"
                      onClick={(e) => handleDelete(e, env.id)}
                      title="Delete Environment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary flex items-center gap-2"><KeyRound size={16} className="text-muted-foreground"/> Variables</span>
                  <span className="font-semibold text-text-primary bg-surface-base px-2.5 py-0.5 rounded-md border border-surface-border">{env._count.variables}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary flex items-center gap-2"><CalendarDays size={16} className="text-muted-foreground"/> Created</span>
                  <span className="font-medium text-text-primary">{new Date(env.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm" style={{ backgroundColor: env.createdBy.avatarColor }}>
                    {env.createdBy.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs">
                    <p className="text-muted-foreground">Created by</p>
                    <p className="font-semibold text-text-primary">{env.createdBy.displayName}</p>
                  </div>
                </div>
                
                {/* Authorized users avatars pile */}
                <div 
                  className="flex -space-x-2"
                  title="Authorized Users"
                >
                  {env.allowedUsers.slice(0, 3).map(u => (
                    <div key={u.id} className="w-7 h-7 rounded-full border-2 border-surface-elevated flex items-center justify-center text-white text-[10px] font-bold z-10 relative" style={{ backgroundColor: u.avatarColor }} title={u.displayName}>
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {env.allowedUsers.length > 3 && (
                    <div className="w-7 h-7 rounded-full border-2 border-surface-elevated bg-surface-border flex items-center justify-center text-text-secondary text-[10px] font-bold z-0 relative">
                      +{env.allowedUsers.length - 3}
                    </div>
                  )}
                  {env.allowedUsers.length === 0 && (
                     <div className="w-7 h-7 rounded-full border-2 border-dashed border-surface-border bg-surface-base flex items-center justify-center text-muted-foreground z-0 relative">
                       <Lock size={12} />
                     </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {environments.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-surface-border rounded-2xl">
              <Server className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold text-text-primary">No Environments Yet</h3>
              <p className="text-text-secondary mt-2 max-w-sm">Create an environment to securely store API keys and secrets for your projects.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-2xl max-w-md w-full shadow-2xl border border-surface-border overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-xl font-bold text-text-primary">Create Environment</h2>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Environment Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Production, Staging, Pre-Prod"
                  className="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-2.5 text-text-primary placeholder:text-muted-foreground focus:outline-none focus:border-[#5B5FEF] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Project</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  required
                  className="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-[#5B5FEF] transition-colors"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Allowed Access (Optional)</label>
                <div className="bg-surface-base border border-surface-border rounded-xl max-h-40 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {users.filter(u => u.id !== currentUserId).map(user => (
                    <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-elevated cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                          else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }}
                        className="w-4 h-4 rounded text-[#5B5FEF] border-surface-border bg-surface-base focus:ring-[#5B5FEF]"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold" style={{ backgroundColor: user.avatarColor }}>
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-text-primary">{user.displayName}</span>
                      </div>
                    </label>
                  ))}
                  {users.length <= 1 && (
                    <p className="text-sm text-muted-foreground p-2">No other users to add.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Admins automatically have full access to all environments.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-text-secondary font-medium hover:bg-surface-base rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newName.trim() || !selectedProjectId}
                  className="bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Environment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAccessEnv && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-2xl max-w-md w-full shadow-2xl border border-surface-border overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-xl font-bold text-text-primary">Manage Access</h2>
              <p className="text-xs text-muted-foreground mt-1">Select who can view {editingAccessEnv.name} variables</p>
            </div>
            
            <form onSubmit={handleUpdateAccess} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Allowed Users</label>
                <div className="bg-surface-base border border-surface-border rounded-xl max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {users.filter(u => u.id !== currentUserId).map(user => (
                    <label key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-elevated cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={editAccessUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) setEditAccessUsers([...editAccessUsers, user.id]);
                          else setEditAccessUsers(editAccessUsers.filter(id => id !== user.id));
                        }}
                        className="w-4 h-4 rounded text-[#5B5FEF] border-surface-border bg-surface-base focus:ring-[#5B5FEF]"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold" style={{ backgroundColor: user.avatarColor }}>
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-text-primary">{user.displayName}</span>
                      </div>
                    </label>
                  ))}
                  {users.length <= 1 && (
                    <p className="text-sm text-muted-foreground p-2">No other users to add.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Admins automatically have full access.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccessEnv(null);
                    setEditAccessUsers([]);
                  }}
                  className="px-5 py-2.5 text-text-secondary font-medium hover:bg-surface-base rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingAccess}
                  className="bg-[#5B5FEF] hover:bg-[#4B4FE0] text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {isUpdatingAccess ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
