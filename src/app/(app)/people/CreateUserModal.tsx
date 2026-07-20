"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema } from "@/lib/validators";
import { createUser } from "@/server/actions/user.actions";
import type { z } from "zod";
import { Loader2, X } from "lucide-react";

type CreateUserForm = z.infer<typeof createUserSchema>;

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "MEMBER", department: "GENERAL" },
  });

  const onSubmit = async (data: CreateUserForm) => {
    setError(null);
    const result = await createUser(data as any);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess(`User created! Temp password: ${data.tempPassword}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold text-text-primary mb-5">Add team member</h2>

        {error && <div className="mb-4 text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</div>}
        {success ? (
          <div className="text-center">
            <div className="mb-4 text-sm text-[#1EAE7C] bg-[#1EAE7C]/10 p-3 rounded font-medium">{success}</div>
            <button onClick={onClose} className="px-4 py-2 bg-primary text-white rounded-2xl text-sm">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Display name</label>
                <input
                  {...register("displayName")}
                  placeholder="Priya Sharma"
                  className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground"
                />
                {errors.displayName && <p className="text-xs text-destructive mt-1">{errors.displayName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
                <input
                  {...register("username")}
                  placeholder="priya_s"
                  className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground font-mono"
                />
                {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Temporary Password</label>
                <input
                  {...register("tempPassword")}
                  type="text"
                  placeholder="iflow123 (min 8 chars)"
                  className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none placeholder-muted-foreground font-mono"
                />
                {errors.tempPassword && <p className="text-xs text-destructive mt-1">{errors.tempPassword.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Department</label>
                  <select
                    {...register("department")}
                    className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                  >
                    <option value="DEV">Dev</option>
                    <option value="DESIGN">Design</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
                  <select
                    {...register("role")}
                    className="w-full px-3 py-2 rounded-2xl text-sm text-text-primary bg-surface-base border border-surface-border outline-none"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5 border-t border-surface-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-2xl text-sm text-text-secondary bg-surface-border hover:bg-surface-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Create user
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
