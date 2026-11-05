"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Plus, Search, ShieldCheck, UserX, Users, UserCheck, Crown } from "lucide-react";
import { deactivateUser, resetPassword, updateUserRole } from "@/server/actions/user.actions";
import { Avatar, DepartmentTag } from "@/components/shared";
import { CreateUserModal } from "@/app/(app)/people/CreateUserModal";
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Input, SectionLabel, Select, StatCard, StatGroup } from "@/components/ui";

type Role = "ADMIN" | "MANAGER" | "MEMBER";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  department: "DEV" | "DESIGN" | "MARKETING" | "GENERAL";
  avatarColor: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

interface AdminClientProps {
  users: AdminUser[];
  currentUserId: string;
}

const ROLE_TONE = { ADMIN: "primary", MANAGER: "purple", MEMBER: "neutral" } as const;

export function AdminClient({ users: initialUsers, currentUserId }: AdminClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  // Dialog state replaces the native prompt()/confirm() calls (blocked in many browsers, inaccessible).
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [deactivateFor, setDeactivateFor] = useState<AdminUser | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: AdminUser; role: Role } | null>(null);

  // New users are created in a shared dialog and arrive via the server refresh.
  useEffect(() => setUsers(initialUsers), [initialUsers]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      leads: users.filter((u) => u.role !== "MEMBER").length,
    }),
    [users]
  );

  const visible = users.filter(
    (u) =>
      (roleFilter === "all" || u.role === roleFilter) &&
      (u.displayName + " " + u.username).toLowerCase().includes(query.trim().toLowerCase())
  );

  const doReset = async () => {
    if (!resetFor) return;
    setBusy(resetFor.id + "-reset");
    const result = await resetPassword({ userId: resetFor.id, newTempPassword: tempPassword });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`Password reset for ${resetFor.displayName}`, { description: "They’ll be asked to choose a new one at next sign-in." });
    setUsers((prev) => prev.map((u) => (u.id === resetFor.id ? { ...u, mustChangePassword: true } : u)));
    setResetFor(null);
    setTempPassword("");
  };

  const doDeactivate = async () => {
    if (!deactivateFor) return;
    setBusy(deactivateFor.id);
    const result = await deactivateUser({ userId: deactivateFor.id });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`${deactivateFor.displayName} deactivated`);
    setUsers((prev) => prev.map((u) => (u.id === deactivateFor.id ? { ...u, isActive: false } : u)));
    setDeactivateFor(null);
  };

  const doRoleChange = async () => {
    if (!roleChange) return;
    setBusy(roleChange.user.id + "-role");
    const result = await updateUserRole({ userId: roleChange.user.id, newRole: roleChange.role });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`${roleChange.user.displayName} is now ${roleChange.role.toLowerCase()}`);
    setUsers((prev) => prev.map((u) => (u.id === roleChange.user.id ? { ...u, role: roleChange.role } : u)));
    setRoleChange(null);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-6xl mx-auto space-y-5 animate-fade-in">
      <StatGroup className="grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team members" value={stats.total} tone="primary" icon={<Users size={15} />} />
        <StatCard label="Active" value={stats.active} tone="success" icon={<UserCheck size={15} />} />
        <StatCard label="Inactive" value={stats.inactive} tone={stats.inactive ? "warning" : "neutral"} icon={<UserX size={15} />} />
        <StatCard label="Managers & admins" value={stats.leads} tone="purple" icon={<Crown size={15} />} />
      </StatGroup>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or username…" className="pl-9" aria-label="Search users" />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "all" | Role)} className="!w-auto min-w-[130px]" aria-label="Filter by role">
          <option value="all">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="MEMBER">Member</option>
        </Select>
        <Button variant="primary" className="ml-auto" onClick={() => setShowCreate(true)} id="create-user-btn">
          <Plus size={15} /> Add member
        </Button>
      </div>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Users size={22} />} title="No users match" description="Try a different search or role filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-surface-base/60 border-b border-surface-border text-left">
                  <th className="px-5 py-3"><SectionLabel>User</SectionLabel></th>
                  <th className="px-4 py-3 hidden sm:table-cell"><SectionLabel>Username</SectionLabel></th>
                  <th className="px-4 py-3 hidden md:table-cell"><SectionLabel>Department</SectionLabel></th>
                  <th className="px-4 py-3"><SectionLabel>Role</SectionLabel></th>
                  <th className="px-4 py-3 hidden sm:table-cell"><SectionLabel>Status</SectionLabel></th>
                  <th className="px-5 py-3 text-right"><SectionLabel>Actions</SectionLabel></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {visible.map((user) => (
                  <tr key={user.id} className={`hover:bg-surface-hover/60 transition-colors ${user.isActive ? "" : "opacity-60"}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-foreground truncate">
                            {user.displayName} {user.id === currentUserId && <span className="text-[11px] text-muted-foreground font-normal">(you)</span>}
                          </p>
                          {user.mustChangePassword && <span className="text-[11px] text-amber-500">Must change password</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-[12.5px] text-muted-foreground font-mono">{user.username}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <DepartmentTag department={user.department} />
                    </td>
                    <td className="px-4 py-3">
                      {user.id === currentUserId ? (
                        <Badge tone={ROLE_TONE[user.role]}>
                          <ShieldCheck size={11} /> {user.role[0] + user.role.slice(1).toLowerCase()}
                        </Badge>
                      ) : (
                        <Select
                          value={user.role}
                          onChange={(e) => setRoleChange({ user, role: e.target.value as Role })}
                          disabled={busy === user.id + "-role"}
                          className="!w-auto !min-h-8 !py-1 text-[12.5px]"
                          aria-label={`Role for ${user.displayName}`}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="MANAGER">Manager</option>
                          <option value="ADMIN">Admin</option>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge tone={user.isActive ? "success" : "danger"} dot>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={`Reset password for ${user.displayName}`} onClick={() => { setResetFor(user); setTempPassword(""); }} className="hover:!text-amber-500">
                          <KeyRound size={15} />
                        </IconButton>
                        {user.id !== currentUserId && user.isActive && (
                          <IconButton label={`Deactivate ${user.displayName}`} onClick={() => setDeactivateFor(user)} className="hover:!text-red-500">
                            <UserX size={15} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCreate && (
        <CreateUserModal
          onClose={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {resetFor && (
        <Dialog
          size="sm"
          title="Reset password"
          description={`Set a temporary password for ${resetFor.displayName}.`}
          onClose={() => setResetFor(null)}
          footer={
            <>
              <Button onClick={() => setResetFor(null)}>Cancel</Button>
              <Button variant="primary" loading={busy === resetFor.id + "-reset"} disabled={tempPassword.length < 8} onClick={doReset}>
                Reset password
              </Button>
            </>
          }
        >
          <Field label="Temporary password" hint="At least 8 characters. They must change it on next sign-in.">
            <Input autoFocus value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="font-mono" placeholder="e.g. iflow-2026" onKeyDown={(e) => e.key === "Enter" && tempPassword.length >= 8 && doReset()} />
          </Field>
        </Dialog>
      )}

      {deactivateFor && (
        <Dialog
          size="sm"
          title={`Deactivate ${deactivateFor.displayName}?`}
          description="They won’t be able to sign in. Their work and history stay intact."
          onClose={() => setDeactivateFor(null)}
          footer={
            <>
              <Button onClick={() => setDeactivateFor(null)}>Cancel</Button>
              <Button variant="primary" className="!bg-red-600 hover:!bg-red-700 !text-white" loading={busy === deactivateFor.id} onClick={doDeactivate}>
                Deactivate
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground">You can’t undo this from the interface — reactivation needs a database change.</p>
        </Dialog>
      )}

      {roleChange && (
        <Dialog
          size="sm"
          title="Change role?"
          description={`${roleChange.user.displayName} will become ${roleChange.role.toLowerCase()}.`}
          onClose={() => setRoleChange(null)}
          footer={
            <>
              <Button onClick={() => setRoleChange(null)}>Cancel</Button>
              <Button variant="primary" loading={busy === roleChange.user.id + "-role"} onClick={doRoleChange}>
                Change role
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground">
            {roleChange.role === "ADMIN"
              ? "Admins can manage users, environments, projects and every board."
              : roleChange.role === "MANAGER"
                ? "Managers can create boards and manage assignments and the Page Tracker."
                : "Members work on tickets they can access and the work items assigned to them."}
          </p>
        </Dialog>
      )}
    </div>
  );
}
