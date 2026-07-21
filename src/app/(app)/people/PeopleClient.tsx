"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, DepartmentTag, RelativeTime, EmptyState } from "@/components/shared";
import { Plus, UserX, ShieldCheck, Loader2 } from "lucide-react";
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">People</h1>
          <p className="text-sm text-text-secondary mt-0.5">{users.length} active team member{users.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-all shadow-sm"
            style={{ background: "#5B5FEF" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#4B4FE0")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#5B5FEF")}
          >
            <Plus size={15} />
            Add team member
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <EmptyState message="No active team members yet" description="Admins can add team members from the Admin page" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => {
            return (
              <Link key={user.id} href={`/people/${user.id}`}>
                <div className="rounded-3xl p-5 transition-all cursor-pointer group bg-surface-elevated border border-surface-border hover:border-primary/50 relative">
                  
                  {/* Admin Actions Overlay */}
                  {isAdmin && user.id !== currentUserId && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => openManageAccess(e, user)}
                        className="p-1.5 rounded-2xl bg-surface-base border border-surface-border text-muted-foreground hover:text-primary transition-colors shadow-sm"
                        title="Manage Board Access"
                      >
                        <ShieldCheck size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeactivate(e, user.id, user.displayName)}
                        className="p-1.5 rounded-2xl bg-surface-base border border-surface-border text-muted-foreground hover:text-destructive transition-colors shadow-sm"
                        title="Block User"
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar
                      displayName={user.displayName}
                      avatarColor={user.avatarColor}
                      size="lg"
                      isOnline={user.lastSeenAt ? new Date(user.lastSeenAt).getTime() >= Date.now() - 5 * 60 * 1000 : false}
                    />
                    <div className="min-w-0 pr-12">
                      <p className="font-semibold text-text-primary truncate transition-colors">
                        {user.displayName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <DepartmentTag department={user.department as any} />
                        {user.role === "ADMIN" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Admin</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-surface-border">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-text-primary">{user.assignedCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Assigned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-text-primary">{user.completedCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Done/mo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-text-primary">
                        {user.prodStats ? Math.round((user.prodStats.onTime / user.prodStats.total) * 100) : "—"}
                        {user.prodStats ? "%" : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">On-Time Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Last active</p>
                      {user.lastActivity ? (
                        <RelativeTime date={new Date(user.lastActivity)} />
                      ) : (
                        <p className="text-xs font-mono text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Board Access Modal */}
      {managingAccessFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Manage Access</h2>
            <p className="text-xs text-muted-foreground mb-4">Select boards {managingAccessFor.displayName} can access.</p>
            
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
              {boards.map(b => (
                <label key={b.id} className="flex items-center gap-3 p-2 rounded-2xl bg-surface-base border border-surface-border cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedBoards.has(b.id)}
                    onChange={() => toggleBoard(b.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium text-text-primary">{b.name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setManagingAccessFor(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveBoardAccess}
                disabled={actionLoading === 'save-boards'}
                className="px-4 py-2 text-sm bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === 'save-boards' && <Loader2 size={14} className="animate-spin" />}
                Save Access
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
