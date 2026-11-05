"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";
import { Eye, EyeOff, ArrowRight, CircleCheck, CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/shared/AuthShell";
import { Button, Field, Input } from "@/components/ui";

type LoginForm = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/overview";
  const justChanged = searchParams?.get("changed") === "1";

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setAuthError(null);

    const { signIn } = await import("next-auth/react");
    const result = await signIn("credentials", {
      username: data.username,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setAuthError(result.error === "CredentialsSignin" ? "That username or password isn't right." : `System Error: ${result.error}`);
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Sign in to IFlow</h1>
      <p className="text-[14px] text-muted-foreground mt-1.5">Use the username your administrator gave you.</p>

      {justChanged && (
        <div
          className="mt-6 flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          <CircleCheck size={15} className="mt-px shrink-0" /> Password updated. Sign in with your new password.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        <Field label="Username" error={errors.username?.message}>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            autoCapitalize="none"
            className="!h-10 px-3"
            aria-invalid={!!errors.username}
            {...register("username")}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="!h-10 px-3 pr-10"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {authError && (
          <div className="flex items-start gap-2 text-[13px] text-red-600 dark:text-red-400" role="alert">
            <CircleAlert size={15} className="mt-px shrink-0" />
            {authError}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full group">
          {isLoading ? (
            "Signing in…"
          ) : (
            <>
              Continue
              <ArrowRight size={15} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 pt-6 border-t border-surface-border text-[13px] text-muted-foreground">
        No account yet? Ask an IFlow admin to invite you.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginFormContent />
      </Suspense>
    </AuthShell>
  );
}
