"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema } from "@/lib/validators";
import { createUser, deactivateUser, resetPassword } from "@/server/actions/user.actions";
import { Avatar, DepartmentTag } from "@/components/shared";
import type { z } from "zod";
import {
  Plus,
  UserX,
  KeyRound,
  Loader2,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

type CreateUserForm = z.infer<typeof createUserSchema>;

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
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

export function AdminClient({ users: initialUsers, currentUserId }: AdminClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "MEMBER", department: "GENERAL" },
  });

  const onCreateUser = async (data: CreateUserForm) => {
    setError(null);
    const result = await createUser(data as {
      username: string;
      tempPassword: string;
      displayName: string;
      department: "DEV" | "DESIGN" | "MARKETING" | "GENERAL";
      role: "ADMIN" | "MEMBER";
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess(`User ${data.displayName} created. Temp password: ${data.tempPassword}`);
    setShowCreateDialog(false);
    reset();
    setUsers((prev) => [
      ...prev,
      {
        id: result.data.id,
        username: result.data.username,
        displayName: result.data.displayName,
        role: result.data.role as AdminUser["role"],
        department: result.data.department as AdminUser["department"],
        avatarColor: result.data.avatarColor,
        isActive: result.data.isActive,
        mustChangePassword: result.data.mustChangePassword,
        createdAt: new Date(result.data.createdAt),
      } satisfies AdminUser,
    ]);
  };

  const handleDeactivate = async (userId: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They won't be able to log in.`)) return;
    setActionLoading(userId);
    setError(null);
    const result = await deactivateUser({ userId });
    if (!result.success) {
      setError(result.error);
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: false } : u));
      setSuccess(`${name} has been deactivated`);
    }
    setActionLoading(null);
  };

  const handleResetPassword = async (userId: string, name: string) => {
    const newTempPassword = prompt(`Enter new temporary password for ${name} (min 8 chars):`);
    if (!newTempPassword || newTempPassword.length < 8) return;

    setActionLoading(userId + "-reset");
    setError(null);
    const result = await resetPassword({ userId, newTempPassword });
    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(`Password reset for ${name}. Temp: ${newTempPassword}`);
    }
    setActionLoading(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Admin</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage team members</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: "#5B5FEF" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#4B4FE0")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#5B5FEF")}
          id="create-user-btn"
        >
          <Plus size={15} />
          Add team member
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-[#D1495B] bg-[#D1495B]/10 border border-[#D1495B]/30">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-[#1EAE7C] bg-[#1EAE7C]/10 border border-[#1EAE7C]/30">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* User table */}
      <div className="rounded-xl overflow-hidden border border-surface-border">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-elevated border-b border-surface-border">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Username</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Dept</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface-elevated">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[#1F252E] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar displayName={user.displayName} avatarColor={user.avatarColor} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{user.displayName}</p>
                      {user.mustChangePassword && (
                        <span className="text-[10px] text-[#C79A3D] font-mono">must change pw</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span className="text-xs text-text-secondary font-mono">{user.username}</span>
                </td>
                <td className="px-5 py-3 hidden md:table-cell">
                  <DepartmentTag department={user.department} />
                </td>
                <td className="px-5 py-3">
                  {user.role === "ADMIN" ? (
                    <span className="flex items-center gap-1 text-xs text-[#5B5FEF]">
                      <ShieldCheck size={12} />Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <UserIcon size={12} />Member
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 hidden sm:table-cell">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      user.isActive
                        ? "bg-[#1EAE7C]/15 text-[#1EAE7C]"
                        : "bg-[#D1495B]/15 text-[#D1495B]"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleResetPassword(user.id, user.displayName)}
                      disabled={actionLoading === user.id + "-reset"}
                      className="p-1.5 rounded text-muted-foreground hover:text-[#C79A3D] hover:bg-[#C79A3D]/10 transition-all disabled:opacity-40"
                      title="Reset password"
                      aria-label={`Reset password for ${user.displayName}`}
                    >
                      {actionLoading === user.id + "-reset" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <KeyRound size={14} />
                      )}
                    </button>
                    {user.id !== currentUserId && user.isActive && (
                      <button
                        onClick={() => handleDeactivate(user.id, user.displayName)}
                        disabled={actionLoading === user.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-[#D1495B] hover:bg-[#D1495B]/10 transition-all disabled:opacity-40"
                        title="Deactivate user"
                        aria-label={`Deactivate ${user.displayName}`}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserX size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user dialog */}
      {showCreateDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setShowCreateDialog(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
            >
              <h2 className="text-lg font-semibold text-text-primary mb-5">Add team member</h2>

              <form onSubmit={handleSubmit(onCreateUser)} noValidate>
                <div className="space-y-4">
                  <Field label="Display name" error={errors.displayName?.message}>
                    <input
                      {...register("displayName")}
                      placeholder="Priya Sharma"
                      className="w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground"
                      id="create-displayName"
                      aria-label="Display name"
                    />
                  </Field>
                  <Field label="Username" error={errors.username?.message}>
                    <input
                      {...register("username")}
                      placeholder="priya_s (3–20 chars, lowercase)"
                      className="w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground font-mono"
                      id="create-username"
                      aria-label="Username"
                    />
                  </Field>
                  <Field label="Temporary password" error={errors.tempPassword?.message}>
                    <input
                      {...register("tempPassword")}
                      type="text"
                      placeholder="iflow123 (min 8 chars)"
                      className="w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground font-mono"
                      id="create-tempPassword"
                      aria-label="Temporary password"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Department" error={errors.department?.message}>
                      <select
                        {...register("department")}
                        className="w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                        id="create-department"
                        aria-label="Department"
                      >
                        <option value="DEV">Dev</option>
                        <option value="DESIGN">Design</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="GENERAL">General</option>
                      </select>
                    </Field>
                    <Field label="Role" error={errors.role?.message}>
                      <select
                        {...register("role")}
                        className="w-full px-3 py-2 rounded-lg text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                        id="create-role"
                        aria-label="Role"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1 py-2 rounded-lg text-sm text-text-secondary bg-surface-border hover:bg-surface-border/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: "#5B5FEF" }}
                  >
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    Create user
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-[#D1495B] mt-1">{error}</p>}
    </div>
  );
}
