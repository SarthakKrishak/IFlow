"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/shared";
import { Badge, Button, Dialog, EmptyState, IconButton, Input, SectionLabel, Segmented, Select, useConfirm } from "@/components/ui";
import { Plus, UserX, ShieldCheck, Loader2, Search, Filter, LayoutGrid, List as ListIcon, MoreVertical, Clock, Users } from "lucide-react";
import { deactivateUser } from "@/server/actions/user.actions";
import { updateUserBoards } from "@/server/actions/user.boards";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const { confirm: ask, dialog: confirmDialog } = useConfirm();

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
    if (!(await ask({ title: `Deactivate ${name}?`, description: "They won’t be able to sign in. Their work and history stay intact.", confirmLabel: "Deactivate", danger: true }))) return;
    setActionLoading(userId);
    try {
      const result = await deactivateUser({ userId });
      if (result.success) {
        toast.success(`${name} deactivated`);
        setUsers((prev) => prev.filter(u => u.id !== userId));
        router.refresh();
      } else {
        toast.error(result.error || "Failed to deactivate user");
      }
    } catch (error) {
      console.error("Deactivate failed:", error);
      toast.error("Network error — couldn't deactivate user");
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
    try {
      const result = await updateUserBoards({ userId: managingAccessFor.id, boardIds: Array.from(selectedBoards) });
      if (result.success) {
        toast.success("Board access updated");
        setUsers(prev => prev.map(u => u.id === managingAccessFor.id ? { ...u, boardIds: Array.from(selectedBoards) } : u));
        setManagingAccessFor(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update board access");
      }
    } catch (error) {
      console.error("Board access update failed:", error);
      toast.error("Network error — couldn't update board access");
    }
    setActionLoading(null);
  };

  const formatRelativeTime = (date: Date) => {
    const time = new Date(date).getTime();
    if (Number.isNaN(time)) return "—";
    const diff = Date.now() - time;
    if (diff < 0) return "Just now";
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) {
      const h = Math.floor(diff / 3600000);
      if (h > 12) return "yesterday";
      return `${h}h ago`;
    }
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const onlineCount = users.filter(isUserOnline).length;
  const onTimeScore = (u: UserData) =>
    u.prodStats && u.prodStats.total > 0 ? `${Math.round((u.prodStats.onTime / u.prodStats.total) * 100)}%` : "—";

  const RoleBadges = ({ user }: { user: UserData }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[12px] text-muted-foreground capitalize">{user.department.toLowerCase()}</span>
      {user.role === "ADMIN" && <Badge tone="primary">Admin</Badge>}
      {user.role === "MANAGER" && <Badge tone="purple">Manager</Badge>}
    </div>
  );

  const RowMenu = ({ user }: { user: UserData }) =>
    isAdmin && user.id !== currentUserId ? (
      <div className="relative">
        <IconButton
          label={`Actions for ${user.displayName}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveDropdown(activeDropdown === user.id ? null : user.id);
          }}
        >
          <MoreVertical size={16} />
        </IconButton>
        {activeDropdown === user.id && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
            <div className="absolute top-full right-0 mt-1 w-48 bg-surface-elevated border border-surface-border rounded-xl shadow-pop overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 p-1">
              <button
                onClick={(e) => openManageAccess(e, user)}
                className="w-full flex items-center gap-2 px-3 h-9 text-[13px] font-medium text-foreground hover:bg-surface-hover rounded-lg transition-colors text-left"
              >
                <ShieldCheck size={14} className="text-muted-foreground" /> Manage board access
              </button>
              <button
                onClick={(e) => {
                  setActiveDropdown(null);
                  handleDeactivate(e, user.id, user.displayName);
                }}
                disabled={actionLoading === user.id}
                className="w-full flex items-center gap-2 px-3 h-9 text-[13px] font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left"
              >
                {actionLoading === user.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Deactivate user
              </button>
            </div>
          </>
        )}
      </div>
    ) : null;

  const filtersActive = searchInput !== "" || roleFilter !== "All Roles" || statusFilter !== "All Status";

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1440px] mx-auto animate-fade-in pb-24 space-y-5">
      {/* One toolbar: find · filter · view · add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input type="text" placeholder="Search people…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" aria-label="Search people" />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="!w-auto min-w-[130px]" aria-label="Filter by role">
          <option value="All Roles">All roles</option>
          {uniqueRoles.map((r) => (
            <option key={r} value={r}>
              {r[0] + r.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto min-w-[130px]" aria-label="Filter by status">
          <option value="All Status">Any status</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </Select>
        {filtersActive && (
          <button
            onClick={() => {
              setSearchInput("");
              setRoleFilter("All Roles");
              setStatusFilter("All Status");
            }}
            className="h-9 px-2.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="hidden md:flex items-center gap-1.5 text-[12.5px] text-muted-foreground mr-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <b className="text-foreground tabular-nums">{onlineCount}</b> online · <b className="text-foreground tabular-nums">{users.length}</b> members
          </span>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "grid", label: <LayoutGrid size={15} aria-label="Grid view" /> },
              { value: "list", label: <ListIcon size={15} aria-label="List view" /> },
            ]}
          />
          {isAdmin && (
            <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
              <Plus size={15} /> Add member
            </Button>
          )}
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No team members found"
          description="Try a different search or clear the filters."
          action={filtersActive ? <Button onClick={() => { setSearchInput(""); setRoleFilter("All Roles"); setStatusFilter("All Status"); }}>Clear filters</Button> : undefined}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredUsers.map((user) => {
            const isOnline = isUserOnline(user);
            return (
              <Link key={user.id} href={`/people/${user.id}`} className="surface-card p-4 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md relative flex flex-col group">
                <div className="flex justify-between items-start gap-2 mb-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="lg" />
                      {isOnline && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-surface-elevated" title="Online" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[14px] font-semibold text-foreground block truncate">{user.displayName}</span>
                      <RoleBadges user={user} />
                    </div>
                  </div>
                  <RowMenu user={user} />
                </div>

                <div className="grid grid-cols-3 rounded-lg border border-surface-border divide-x divide-surface-border mb-4">
                  {[
                    { v: user.assignedCount, l: "Assigned" },
                    { v: user.completedCount, l: "Done / mo" },
                    { v: onTimeScore(user), l: "On-time" },
                  ].map((st) => (
                    <div key={st.l} className="py-2.5 text-center">
                      <p className="text-[17px] font-semibold text-foreground tabular-nums leading-none">{st.v}</p>
                      <p className="text-[10.5px] text-muted-foreground mt-1.5">{st.l}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-auto text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <Clock size={13} /> Last active
                  </span>
                  <span className="text-[12px] font-medium text-foreground/80">{user.lastActivity ? formatRelativeTime(user.lastActivity) : "—"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[860px]">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-5 py-3 w-[32%]"><SectionLabel>Team member</SectionLabel></th>
                  <th className="px-4 py-3"><SectionLabel>Role</SectionLabel></th>
                  <th className="px-4 py-3 text-center"><SectionLabel>Assigned</SectionLabel></th>
                  <th className="px-4 py-3 text-center"><SectionLabel>Done / mo</SectionLabel></th>
                  <th className="px-4 py-3 text-center"><SectionLabel>On-time</SectionLabel></th>
                  <th className="px-4 py-3"><SectionLabel>Last active</SectionLabel></th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filteredUsers.map((user) => {
                  const isOnline = isUserOnline(user);
                  return (
                    <tr key={user.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="md" />
                            {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-elevated" />}
                          </div>
                          <Link href={`/people/${user.id}`} className="text-[13.5px] font-semibold text-foreground hover:underline underline-offset-2 decoration-foreground/30">
                            {user.displayName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3"><RoleBadges user={user} /></td>
                      <td className="px-4 py-3 text-center text-[13px] tabular-nums">{user.assignedCount}</td>
                      <td className="px-4 py-3 text-center text-[13px] tabular-nums">{user.completedCount}</td>
                      <td className="px-4 py-3 text-center text-[13px] tabular-nums">{onTimeScore(user)}</td>
                      <td className="px-4 py-3 text-[12.5px] text-muted-foreground">{user.lastActivity ? formatRelativeTime(user.lastActivity) : "—"}</td>
                      <td className="px-4 py-3 text-right"><RowMenu user={user} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDialog}
      {managingAccessFor && (
        <Dialog
          size="sm"
          title="Manage board access"
          description={`Choose which boards ${managingAccessFor.displayName} can open.`}
          onClose={() => setManagingAccessFor(null)}
          footer={
            <>
              <Button onClick={() => setManagingAccessFor(null)}>Cancel</Button>
              <Button variant="primary" loading={actionLoading === "save-boards"} onClick={saveBoardAccess}>
                Save access
              </Button>
            </>
          }
        >
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {boards.length === 0 && <p className="text-[13px] text-muted-foreground">There are no boards yet.</p>}
            {boards.map((b) => (
              <label key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-base border border-surface-border cursor-pointer hover:border-foreground/20 transition-colors">
                <input type="checkbox" checked={selectedBoards.has(b.id)} onChange={() => toggleBoard(b.id)} className="accent-primary w-4 h-4" />
                <span className="text-[13px] font-medium text-foreground">{b.name}</span>
              </label>
            ))}
          </div>
        </Dialog>
      )}

      {showCreateDialog && <CreateUserModal onClose={() => { setShowCreateDialog(false); router.refresh(); }} />}
    </div>
  );
}
