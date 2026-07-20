"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";
import { Eye, EyeOff, Loader2, User, Lock, ArrowRight } from "lucide-react";
import Image from "next/image";

type LoginForm = z.infer<typeof loginSchema>;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/dashboard";

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
    <div className="w-full max-w-[400px] mx-auto space-y-8">
      {/* Logo & Header */}
      <div className="flex flex-col items-center">
        {/* Placeholder for the logo - User will replace this with their actual logo in public/logo.png */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative w-8 h-8">
            <Image
              src="/logo.png"
              alt="IFlow Logo"
              width={32}
              height={32}
              className="object-contain"
              onError={(e) => {
                // Fallback if logo is not yet placed
                e.currentTarget.style.display = 'none';
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
                className="w-full pl-10 pr-3 py-3 rounded-xl text-sm text-text-primary placeholder-muted-foreground transition-all"
                style={{
                  background: "transparent",
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
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-text-primary placeholder-muted-foreground transition-all"
                style={{
                  background: "transparent",
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

        {authError && (
          <div
            className="px-4 py-3 rounded-xl text-sm text-[#D1495B]"
            style={{ background: "#D1495B18", border: "1px solid #D1495B40" }}
            role="alert"
          >
            {authError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
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
          <span className="px-4 bg-surface-base text-muted-foreground">or</span>
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
    <div className="min-h-screen w-full flex bg-[#0F172A] overflow-hidden">
      
      {/* Left Pane - Blue Gradient & Logo */}
      <div className="hidden lg:flex relative w-[40%] flex-col items-center justify-center overflow-hidden">
        {/* Deep blue background gradient */}
        <div 
          className="absolute inset-0 z-0" 
          style={{ 
            background: "radial-gradient(circle at top left, #1E3A8A 0%, #0F172A 70%)" 
          }} 
        />
        
        {/* Abstract lines/stars placeholder */}
        <div className="absolute inset-0 z-0 opacity-30 mix-blend-overlay">
           {/* If you have a background pattern image, you can add it here: <Image src="/login-bg.png" fill className="object-cover" /> */}
           <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_white] animate-pulse" />
           <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_15px_#60A5FA] animate-pulse" style={{ animationDelay: "1s" }} />
           <div className="absolute top-1/2 left-1/2 w-96 h-96 border border-blue-500/20 rounded-full rounded-tl-none -translate-x-1/2 -translate-y-1/2" />
           <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] border border-blue-500/10 rounded-full rounded-br-none -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Large Centered Logo */}
        <div className="relative z-10 w-64 h-64 flex items-center justify-center">
           {/* User will place their large logo in public/logo-large.png */}
           <Image
              src="/logo-large.png"
              alt="IFlow Hero"
              fill
              className="object-contain drop-shadow-2xl"
              onError={(e) => {
                // Fallback 3D box if image isn't added yet
                e.currentTarget.style.display = 'none';
              }}
            />
           
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:rounded-l-[40px] bg-surface-base shadow-[-20px_0_40px_rgba(0,0,0,0.2)] z-10 overflow-y-auto">
        <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#2563EB]" /></div>}>
          <LoginFormContent />
        </Suspense>
      </div>

    </div>
  );
}
