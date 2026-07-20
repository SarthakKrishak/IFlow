"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateOwnPasswordSchema } from "@/lib/validators";
import { updateOwnPassword } from "@/server/actions/user.actions";
import type { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

type ChangePasswordForm = z.infer<typeof updateOwnPasswordSchema>;

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
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(updateOwnPasswordSchema),
  });

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
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#5B5FEF]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#5B5FEF]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-3xl flex items-center justify-center text-white font-bold text-lg mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #5B5FEF 0%, #4B4FE0 100%)" }}
          >
            IF
          </div>
        </div>

        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{ background: "hsl(var(--surface-elevated))", border: "1px solid hsl(var(--surface-border))" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-2xl bg-[#5B5FEF]/15 flex items-center justify-center">
              <ShieldCheck size={16} className="text-[#5B5FEF]" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary">Set your password</h1>
          </div>
          <p className="text-sm text-text-secondary mb-6 ml-11">
            You must set a new password before continuing.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-4">
              {/* Current password */}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Temporary password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    {...register("currentPassword")}
                    className="w-full px-3 py-2.5 pr-10 rounded-2xl text-sm text-text-primary placeholder-muted-foreground"
                    style={{
                      background: "hsl(var(--surface-base))",
                      border: errors.currentPassword ? "1px solid #D1495B" : "1px solid hsl(var(--surface-border))",
                      outline: "none",
                    }}
                    placeholder="••••••••"
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#5B5FEF")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = errors.currentPassword ? "#D1495B" : "hsl(var(--surface-border))")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text-secondary"
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-xs text-[#D1495B] mt-1">{errors.currentPassword.message}</p>
                )}
              </div>

              {/* New password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("newPassword")}
                    className="w-full px-3 py-2.5 pr-10 rounded-2xl text-sm text-text-primary placeholder-muted-foreground"
                    style={{
                      background: "hsl(var(--surface-base))",
                      border: errors.newPassword ? "1px solid #D1495B" : "1px solid hsl(var(--surface-border))",
                      outline: "none",
                    }}
                    placeholder="At least 8 characters"
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#5B5FEF")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = errors.newPassword ? "#D1495B" : "hsl(var(--surface-border))")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text-secondary"
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPasswordValue.length > 0 && newPasswordValue.length < 8 && (
                  <p className="text-xs text-[#C79A3D] mt-1">
                    {8 - newPasswordValue.length} more character{8 - newPasswordValue.length !== 1 ? "s" : ""} required
                  </p>
                )}
                {errors.newPassword && (
                  <p className="text-xs text-[#D1495B] mt-1">{errors.newPassword.message}</p>
                )}
              </div>

              {serverError && (
                <div
                  className="px-3 py-2.5 rounded-2xl text-sm text-[#D1495B]"
                  style={{ background: "#D1495B18", border: "1px solid #D1495B40" }}
                  role="alert"
                >
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-2xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 mt-2"
                style={{
                  background: isLoading ? "#4B4FE0" : "#5B5FEF",
                  opacity: isLoading ? 0.8 : 1,
                }}
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Set password &amp; continue
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={async () => { const { signOut } = await import("next-auth/react"); signOut({ callbackUrl: "/login" }); }}
            className="text-sm text-muted-foreground hover:text-text-secondary transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
