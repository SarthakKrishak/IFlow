"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";
import { Eye, EyeOff, Loader2, User, Lock, ArrowRight } from "lucide-react";

type LoginForm = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/overview";

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

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
      setAuthError("That username or password isn't right.");
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="w-full space-y-8">
      {/* Logo & Header */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6">
          <div className="relative w-8 h-8 flex-shrink-0">
            <img
              src="/logo.png"
              alt="IFlow Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: bold; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);">IF</div>';
              }}
            />
          </div>
          <span className="text-xl font-bold text-text-primary tracking-tight">IFlow</span>
        </div>
        
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Welcome back</h1>
        <p className="text-sm text-text-secondary mt-2">Sign in to continue to IFlow</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <User size={18} />
              </div>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                {...register("username")}
                className="w-full pl-10 pr-3 py-3 rounded-2xl text-sm text-text-primary placeholder-muted-foreground transition-all"
                style={{
                  background: "hsl(var(--surface-base))",
                  border: errors.username ? "1px solid #D1495B" : "1px solid hsl(var(--surface-border))",
                  outline: "none",
                }}
                placeholder="Enter your username"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563EB";
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.username ? "#D1495B" : "hsl(var(--surface-border))";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-[#D1495B] mt-1.5">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-primary mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                {...register("password")}
                className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm text-text-primary placeholder-muted-foreground transition-all"
                style={{
                  background: "hsl(var(--surface-base))",
                  border: errors.password ? "1px solid #D1495B" : "1px solid hsl(var(--surface-border))",
                  outline: "none",
                }}
                placeholder="Enter your password"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563EB";
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.password
                    ? "#D1495B"
                    : "hsl(var(--surface-border))";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text-secondary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-[#D1495B] mt-1.5">{errors.password.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            Forgot password?
          </button>
        </div>

        {authError && (
          <div
            className="px-4 py-3 rounded-2xl text-sm text-[#D1495B]"
            style={{ background: "#D1495B18", border: "1px solid #D1495B40" }}
            role="alert"
          >
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-2xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          style={{
            background: "linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)",
            opacity: isLoading ? 0.8 : 1,
          }}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-surface-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-surface-elevated text-muted-foreground">or</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button type="button" className="font-medium text-primary hover:text-primary/80 transition-colors">
          Contact your administrator
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--surface-base)" }}
    >
      <div className="w-full max-w-5xl bg-surface-elevated rounded-[40px] shadow-2xl border border-surface-border/50 overflow-hidden flex flex-col md:flex-row relative z-10 animate-fade-in">
        
        {/* Left Side: Abstract Branding */}
        <div className="hidden md:flex flex-col w-1/2 p-12 relative overflow-hidden justify-between" style={{ background: "radial-gradient(circle at top left, #1E3A8A 0%, #0F172A 100%)" }}>
          {/* Abstract Background Elements */}
          <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none">
             <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white] animate-pulse" />
             <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_15px_#60A5FA] animate-pulse" style={{ animationDelay: "1s" }} />
             <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] border border-blue-500/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
             <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] border border-blue-500/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10">
                <img src="/logo.png" alt="IFlow Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">IFlow</span>
            </div>
            <p className="text-blue-200/80 text-sm font-medium">Developed By Imaginum</p>
          </div>

          <div className="relative z-10">
            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">Master your<br/>workflow.</h2>
            <p className="text-blue-200/80 text-lg">The premium project management tool for modern teams.</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 lg:p-16 bg-surface-elevated flex flex-col justify-center">
          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#2563EB]" /></div>}>
            <LoginFormContent />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
