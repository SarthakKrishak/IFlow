"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateOwnPasswordSchema } from "@/lib/validators";
import { updateOwnPassword } from "@/server/actions/user.actions";
import type { z } from "zod";
import { Eye, EyeOff, CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/shared/AuthShell";
import { Button, Field, Input } from "@/components/ui";

type ChangePasswordForm = z.infer<typeof updateOwnPasswordSchema>;

function PasswordInput({
  show,
  onToggle,
  ...props
}: React.ComponentProps<"input"> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="!h-10 px-3 pr-10" />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function ChangePasswordPage() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(updateOwnPasswordSchema) });

  const newPasswordValue = watch("newPassword", "");

  const onSubmit = async (data: ChangePasswordForm) => {
    setIsLoading(true);
    setServerError(null);

    const result = await updateOwnPassword(data);

    if (!result.success) {
      setServerError(result.error);
      setIsLoading(false);
      return;
    }

    // Force session refresh — sign out and redirect to login
    const { signOut } = await import("next-auth/react");
    await signOut({ redirect: false });
    window.location.href = "/login?changed=1";
  };

  return (
    <AuthShell>
      <div>
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Set a new password</h1>
          <p className="text-[14px] text-muted-foreground mt-1.5">Replace the temporary password before you continue.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          <Field label="Temporary password" error={errors.currentPassword?.message}>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              autoFocus
                            show={showCurrent}
              onToggle={() => setShowCurrent(!showCurrent)}
              aria-invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
          </Field>

          <Field
            label="New password"
            error={errors.newPassword?.message}
            hint={
              newPasswordValue.length > 0 && newPasswordValue.length < 8
                ? `${8 - newPasswordValue.length} more character${8 - newPasswordValue.length !== 1 ? "s" : ""} required`
                : "At least 8 characters"
            }
          >
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
                            show={showNew}
              onToggle={() => setShowNew(!showNew)}
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
          </Field>

          {serverError && (
            <div className="flex items-start gap-2 text-[13px] text-red-600 dark:text-red-400" role="alert">
              <CircleAlert size={15} className="mt-px shrink-0" />
              {serverError}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
            {isLoading ? "Saving…" : "Save and sign in again"}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-surface-border flex items-center justify-between text-[13px]">
          <Link href="/overview" className="text-muted-foreground hover:text-foreground transition-colors">
            Back to IFlow
          </Link>
          <button
            onClick={async () => {
              const { signOut } = await import("next-auth/react");
              signOut({ callbackUrl: "/login" });
            }}
            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
