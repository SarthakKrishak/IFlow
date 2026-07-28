"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Avatar, RelativeTime, EmptyState } from "@/components/shared";
import { Plus, UserX, ShieldCheck, Loader2, Search, Filter, LayoutGrid, List as ListIcon, MoreVertical, Clock, Users } from "lucide-react";
import { deactivateUser } from "@/server/actions/user.actions";
import { updateUserBoards } from "@/server/actions/user.boards";
import { useRouter } from "next/navigation";
import { CreateUserModal } from "./CreateUserModal";

interface Board {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  displayName: string;
  avatarColor: string;
  department: string;
  role: string;
  assignedCount: number;
  completedCount: number;
  prodStats: { total: number; onTime: number } | null;
  lastActivity: Date | null;
  lastSeenAt: Date | null;
  boardIds: string[];
}

interface PeopleClientProps {
  initialUsers: UserData[];
  isAdmin: boolean;
  currentUserId: string;
  boards: Board[];
}

export function PeopleClient({ initialUsers, isAdmin, currentUserId, boards }: PeopleClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [managingAccessFor, setManagingAccessFor] = useState<UserData | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  // Filters & View state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const uniqueRoles = Array.from(new Set(initialUsers.map(u => u.role)));

  const isUserOnline = (user: UserData) => {
    return user.lastSeenAt ? new Date(user.lastSeenAt).getTime() >= Date.now() - 5 * 60 * 1000 : false;
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.displayName.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchRole = roleFilter === "All Roles" || u.role === roleFilter;
      
      let matchStatus = true;
      if (statusFilter === "Online") matchStatus = isUserOnline(u);
      if (statusFilter === "Offline") matchStatus = !isUserOnline(u);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, debouncedSearch, roleFilter, statusFilter]);

  const handleDeactivate = async (e: React.MouseEvent, userId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Deactivate ${name}? They won't be able to log in.`)) return;
    setActionLoading(userId);
    const result = await deactivateUser({ userId });
    if (result.success) {
      setUsers((prev) => prev.filter(u => u.id !== userId));
      router.refresh();
    }
    setActionLoading(null);
  };

  const openManageAccess = (e: React.MouseEvent, user: UserData) => {
    e.preventDefault();
    e.stopPropagation();
    setManagingAccessFor(user);
    setSelectedBoards(new Set(user.boardIds));
    setActiveDropdown(null);
  };

  const toggleBoard = (id: string) => {
    const next = new Set(selectedBoards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBoards(next);
  };

  const saveBoardAccess = async () => {
    if (!managingAccessFor) return;
    setActionLoading('save-boards');
    const result = await updateUserBoards({ userId: managingAccessFor.id, boardIds: Array.from(selectedBoards) });
    if (result.success) {
      setUsers(prev => prev.map(u => u.id === managingAccessFor.id ? { ...u, boardIds: Array.from(selectedBoards) } : u));
      setManagingAccessFor(null);
      router.refresh();
    }
    setActionLoading(null);
  };

  const formatRelativeTime = (date: Date) => {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) {
      const h = Math.floor(diff / 3600000);
      if (h > 12) return "yesterday";
      return `${h}h ago`;
    }
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1500px] mx-auto animate-fade-in pb-24">
      
      {/* Header Area */}
      <div className="flex justify-end mb-8">


        {/* Filters and Controls */}
        <div className="flex flex-col items-end gap-4">
          <div className="flex items-center gap-3 flex-wrap justify-end">
            
            {isAdmin && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all shadow-sm bg-primary hover:bg-primary/90"
              >
                <Plus size={14} />
                Add team member
              </button>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search people..." 
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="pl-9 pr-3 py-2 w-64 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-medium text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <select 
              value={roleFilter} 
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="All Roles">All Roles</option>
              {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border text-[12px] font-bold text-foreground outline-none cursor-pointer flex items-center"
            >
              <option value="All Status">All Status</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>

          {/* View Toggles */}
          <div className="flex items-center bg-surface-elevated border border-surface-border rounded-xl p-1">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {filteredUsers.length === 0 ? (
        <EmptyState message="No team members found" description="Try adjusting your filters or search query" />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map(user => {
            const isOnline = isUserOnline(user);
            
            return (
              <Link key={user.id} href={`/people/${user.id}`} className="bg-surface-elevated border border-surface-border rounded-3xl p-6 transition-all hover:border-primary/30 relative flex flex-col group block">
                
                {/* Top Section */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                       <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="lg" />
                       {isOnline && (
                         <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-surface-elevated"></div>
                       )}
                    </div>
                    <div>
                      <span className="text-[15px] font-bold text-foreground group-hover:text-primary transition-colors block mb-1">
                        {user.displayName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${user.role === 'ADMIN' ? 'bg-primary' : 'bg-orange-500'}`}></div>
                        <span className="text-[12px] font-medium text-muted-foreground capitalize">{user.department}</span>
                        {user.role === "ADMIN" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold ml-1">Admin</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Menu */}
                  {isAdmin && user.id !== currentUserId && (
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdown(activeDropdown === user.id ? null : user.id); }}
                        className="p-1.5 rounded-xl border border-surface-border text-muted-foreground hover:text-foreground transition-colors hover:bg-surface-base"
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeDropdown === user.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                          <div className="absolute top-full right-0 mt-2 w-48 bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 p-2">
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openManageAccess(e, user); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-foreground hover:bg-surface-base rounded-xl transition-colors text-left"
                            >
                              <ShieldCheck size={14} className="text-muted-foreground" /> Manage Access
                            </button>
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdown(null); handleDeactivate(e, user.id, user.displayName); }}
                              disabled={actionLoading === user.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                            >
                              {actionLoading === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Block User
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px w-full bg-surface-border mb-4"></div>

                {/* Stats Section */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-foreground">{user.assignedCount}</p>
                    <p className="text-[10px] font-medium text-muted-foreground mt-1">Assigned</p>
                  </div>
                  <div className="text-center border-l border-surface-border">
                    <p className="text-[18px] font-bold text-foreground">{user.completedCount}</p>
                    <p className="text-[10px] font-medium text-muted-foreground mt-1">Done/mo</p>
                  </div>
                  <div className="text-center border-l border-surface-border">
                    <p className="text-[18px] font-bold text-foreground">
                      {user.prodStats && user.prodStats.total > 0 ? `${Math.round((user.prodStats.onTime / user.prodStats.total) * 100)}%` : "—"}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground mt-1">On-Time Score</p>
                  </div>
                </div>

                <div className="h-px w-full bg-surface-border mb-4"></div>

                {/* Last Active */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={14} />
                    <span className="text-[11px] font-medium">Last active</span>
                  </div>
                  <span className="text-[12px] font-bold text-muted-foreground">
                    {user.lastActivity ? formatRelativeTime(user.lastActivity) : "—"}
                  </span>
                </div>

              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface-elevated border border-surface-border rounded-3xl overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
             <table className="w-full text-left min-w-[1000px]">
               <thead>
                 <tr className="border-b border-surface-border bg-surface-base">
                   <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[30%]">Team Member</th>
                   <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%]">Role</th>
                   <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%] text-center">Assigned</th>
                   <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%] text-center">Done/mo</th>
                   <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-[15%] text-center">On-Time Score</th>
                   <th className="px-4 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last Active</th>
                   <th className="px-4 py-4 w-12"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-surface-border">
                 {filteredUsers.map(user => {
                    const isOnline = isUserOnline(user);
                    return (
                      <tr key={user.id} className="hover:bg-surface-base transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                               <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="md" />
                               {isOnline && (
                                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-base"></div>
                               )}
                            </div>
                            <Link href={`/people/${user.id}`} className="text-[14px] font-bold text-foreground hover:text-primary transition-colors">
                              {user.displayName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${user.role === 'ADMIN' ? 'bg-primary' : 'bg-orange-500'}`}></div>
                            <span className="text-[12px] font-medium text-muted-foreground capitalize">{user.department}</span>
                            {user.role === "ADMIN" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold ml-1">Admin</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-foreground">
                          {user.assignedCount}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-foreground">
                          {user.completedCount}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-foreground">
                          {user.prodStats && user.prodStats.total > 0 ? `${Math.round((user.prodStats.onTime / user.prodStats.total) * 100)}%` : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock size={14} />
                            <span className="text-[12px] font-bold">
                              {user.lastActivity ? formatRelativeTime(user.lastActivity) : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isAdmin && user.id !== currentUserId && (
                            <div className="relative">
                              <button 
                                onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors hover:bg-surface-border"
                              >
                                <MoreVertical size={16} />
                              </button>
                              
                              {activeDropdown === user.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                  <div className="absolute top-full right-0 mt-2 w-48 bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 p-2">
                                    <button 
                                      onClick={(e) => openManageAccess(e, user)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-foreground hover:bg-surface-base rounded-xl transition-colors text-left"
                                    >
                                      <ShieldCheck size={14} className="text-muted-foreground" /> Manage Access
                                    </button>
                                    <button 
                                      onClick={(e) => { setActiveDropdown(null); handleDeactivate(e, user.id, user.displayName); }}
                                      disabled={actionLoading === user.id}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                                    >
                                      {actionLoading === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Block User
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                 })}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Board Access Modal */}
      {managingAccessFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-foreground mb-1">Manage Access</h2>
            <p className="text-[13px] text-muted-foreground mb-6">Select boards {managingAccessFor.displayName} can access.</p>
            
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {boards.map(b => (
                <label key={b.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-base border border-surface-border cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedBoards.has(b.id)}
                    onChange={() => toggleBoard(b.id)}
                    className="accent-primary w-4 h-4 rounded border-surface-border"
                  />
                  <span className="text-[13px] font-bold text-foreground">{b.name}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setManagingAccessFor(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-surface-base border border-surface-border rounded-xl hover:bg-surface-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveBoardAccess}
                disabled={actionLoading === 'save-boards'}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'save-boards' && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      {showCreateDialog && (
        <CreateUserModal onClose={() => { setShowCreateDialog(false); router.refresh(); }} />
      )}
    </div>
  );
}
