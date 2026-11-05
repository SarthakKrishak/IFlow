"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema } from "@/lib/validators";
import { createUser } from "@/server/actions/user.actions";
import type { z } from "zod";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";

type CreateUserForm = z.infer<typeof createUserSchema>;

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

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
    setCreated({ username: data.username, password: data.tempPassword });
  };

  if (created) {
    return (
      <Dialog
        size="sm"
        title="Member added"
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pt-0.5">
              Share these sign-in details. They’ll be asked to choose a new password on first login.
            </p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-base divide-y divide-surface-border text-[13px]">
            <div className="flex justify-between px-3.5 py-2.5">
              <span className="text-muted-foreground">Username</span>
              <span className="font-mono font-medium">{created.username}</span>
            </div>
            <div className="flex justify-between items-center px-3.5 py-2.5">
              <span className="text-muted-foreground">Temporary password</span>
              <span className="flex items-center gap-2">
                <span className="font-mono font-medium">{created.password}</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy password"
                  onClick={() => {
                    navigator.clipboard?.writeText(created.password);
                    toast.success("Copied");
                  }}
                >
                  <Copy size={14} />
                </button>
              </span>
            </div>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      size="sm"
      title="Add team member"
      description="Create an account with a temporary password."
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" variant="primary" loading={isSubmitting}>
            Create user
          </Button>
        </>
      }
    >
      {error && <div className="mb-4 text-[13px] text-red-500 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">{error}</div>}
      <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Display name" error={errors.displayName?.message}>
          <Input {...register("displayName")} placeholder="Priya Sharma" autoFocus />
        </Field>
        <Field label="Username" error={errors.username?.message}>
          <Input {...register("username")} placeholder="priya_s" className="font-mono" />
        </Field>
        <Field label="Temporary password" error={errors.tempPassword?.message} hint="At least 8 characters">
          <Input {...register("tempPassword")} type="text" placeholder="iflow123" className="font-mono" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Select {...register("department")}>
              <option value="DEV">Dev</option>
              <option value="DESIGN">Design</option>
              <option value="MARKETING">Marketing</option>
              <option value="GENERAL">General</option>
            </Select>
          </Field>
          <Field label="Role">
            <Select {...register("role")}>
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
