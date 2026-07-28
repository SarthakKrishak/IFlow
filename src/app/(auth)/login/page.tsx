"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validators";
import type { z } from "zod";
import { Eye, EyeOff, Loader2, User, Lock, ArrowRight, CheckCircle2, Users, TrendingUp } from "lucide-react";

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
    <div className="w-full max-w-[400px] mx-auto space-y-8 animate-fade-in">
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
                e.currentTarget.parentElement!.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; font-weight: bold; background: #2563EB;">IF</div>';
              }}
            />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">IFlow</span>
        </div>
        
        <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
        <p className="text-[14px] text-muted-foreground mt-2">Sign in to continue to IFlow</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-[13px] font-bold text-white mb-2"
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
                className="w-full pl-10 pr-3 py-3.5 rounded-xl text-[14px] text-white placeholder-muted-foreground transition-all"
                style={{
                  background: "#13151a",
                  border: errors.username ? "1px solid #D1495B" : "1px solid #232733",
                  outline: "none",
                }}
                placeholder="Enter your username"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563EB";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.username ? "#D1495B" : "#232733";
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
              className="block text-[13px] font-bold text-white mb-2"
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
                className="w-full pl-10 pr-10 py-3.5 rounded-xl text-[14px] text-white placeholder-muted-foreground transition-all"
                style={{
                  background: "#13151a",
                  border: errors.password ? "1px solid #D1495B" : "1px solid #232733",
                  outline: "none",
                }}
                placeholder="Enter your password"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#2563EB";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.password
                    ? "#D1495B"
                    : "#232733";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
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
          className="w-full py-4 px-4 rounded-xl text-[15px] font-bold text-white transition-all flex items-center justify-center gap-2 group bg-[#2563EB] hover:bg-[#1D4ED8]"
          style={{ opacity: isLoading ? 0.8 : 1 }}
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

      <div className="relative pt-2">
        <div className="absolute inset-0 flex items-center pt-2">
          <div className="w-full border-t border-[#232733]"></div>
        </div>
        <div className="relative flex justify-center text-[12px]">
          <span className="px-4 bg-[#181a20] text-muted-foreground">or</span>
        </div>
      </div>

      <p className="text-center text-[13px] text-muted-foreground">
        Don't have an account?{" "}
        <button type="button" className="font-bold text-[#3B82F6] hover:text-[#2563EB] transition-colors">
          Contact your administrator
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0f1115]">
      <div className="w-full max-w-[1200px] bg-[#181a20] rounded-3xl shadow-2xl border border-[#232733] flex flex-col md:flex-row overflow-hidden relative z-10 animate-fade-in min-h-[700px]">
        
        {/* Left Side: Branding */}
        <div className="hidden md:flex flex-col w-[55%] p-14 relative overflow-hidden bg-[#0A101F]">
          
          {/* Concentric Circles and Glows */}
          <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] border border-[#1d4ed830] rounded-full" />
            <div className="absolute top-[0%] right-[10%] w-[600px] h-[600px] border border-[#1d4ed840] rounded-full" />
            <div className="absolute top-[20%] right-[30%] w-[400px] h-[400px] border border-[#1d4ed850] rounded-full" />
            <div className="absolute top-[30%] right-[5%] w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_15px_#3B82F6]" />
            <div className="absolute top-[40%] right-[40%] w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_10px_#60A5FA]" />
            <div className="absolute bottom-[20%] right-[15%] w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_20px_#6366F1]" />
            {/* Dark gradient overlay to blend into the left/bottom */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0A101F] via-[#0A101F]/80 to-transparent" />
          </div>

          <div className="relative z-10 mb-16">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8">
                <img src="/logo.png" alt="IFlow Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">IFlow</span>
            </div>
            <p className="text-muted-foreground text-[13px] font-medium ml-1">Developed By Imaginum</p>
          </div>

          <div className="relative z-10 mb-12">
            <h2 className="text-[44px] font-extrabold text-white leading-[1.1] mb-6">
              Master your<br/>
              <span className="text-[#3B82F6]">workflow.</span>
            </h2>
            <p className="text-[#94a3b8] text-[16px] max-w-sm leading-relaxed">
              The premium project management tool for modern teams.
            </p>
          </div>

          {/* Features List */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#1d4ed820] border border-[#1d4ed830] flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold text-[14px]">Organize Projects</h3>
                <p className="text-muted-foreground text-[12px] mt-0.5">Keep everything in one place.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#1d4ed820] border border-[#1d4ed830] flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold text-[14px]">Track Progress</h3>
                <p className="text-muted-foreground text-[12px] mt-0.5">Stay on top of every update.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#1d4ed820] border border-[#1d4ed830] flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold text-[14px]">Drive Results</h3>
                <p className="text-muted-foreground text-[12px] mt-0.5">Ship projects that matter.</p>
              </div>
            </div>
          </div>

          {/* CSS 3D Dashboard Mockup */}
          <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[320px] pointer-events-none" style={{ perspective: "1000px" }}>
             <div className="w-full h-full bg-[#13151a] rounded-[24px] border-[4px] border-[#232733] shadow-2xl flex overflow-hidden" style={{ transform: "rotateX(15deg) rotateY(-20deg) rotateZ(5deg)" }}>
                {/* Fake Sidebar */}
                <div className="w-[80px] bg-[#0c0e12] border-r border-[#232733] p-4 flex flex-col gap-4">
                  <div className="w-6 h-6 bg-[#2563EB] rounded-md mb-4" />
                  <div className="w-8 h-2 bg-[#232733] rounded-full bg-blue-500" />
                  <div className="w-8 h-2 bg-[#232733] rounded-full" />
                  <div className="w-8 h-2 bg-[#232733] rounded-full" />
                </div>
                {/* Fake Content */}
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <div className="w-24 h-3 bg-white/10 rounded-full mb-2" />
                  <div className="flex gap-4">
                     <div className="flex-1 h-16 bg-[#181a20] rounded-xl border border-[#232733] p-3 flex flex-col justify-center gap-2">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                        <div className="w-4 h-4 bg-white rounded-full" />
                     </div>
                     <div className="flex-1 h-16 bg-[#181a20] rounded-xl border border-[#232733] p-3 flex flex-col justify-center gap-2">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                        <div className="w-4 h-4 bg-white rounded-full" />
                     </div>
                     <div className="flex-1 h-16 bg-[#181a20] rounded-xl border border-[#232733] p-3 flex flex-col justify-center gap-2">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full" />
                        <div className="w-4 h-4 bg-white rounded-full" />
                     </div>
                  </div>
                  {/* Fake Chart */}
                  <div className="flex-1 bg-[#181a20] rounded-xl border border-[#232733] mt-2 p-4 relative overflow-hidden">
                     <div className="w-24 h-2 bg-white/10 rounded-full mb-4" />
                     <div className="absolute bottom-[-10px] left-0 w-full h-full pointer-events-none">
                       {/* Curved lines for mock chart */}
                       <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full opacity-80" style={{ transform: "scaleY(-1)" }}>
                         <path d="M0,0 Q20,0 40,20 T70,45 T100,20" fill="none" stroke="#3B82F6" strokeWidth="1.5" />
                         <path d="M0,5 Q30,5 50,15 T80,10 T100,30" fill="none" stroke="#D1495B" strokeWidth="1.5" />
                         <path d="M0,10 Q20,10 40,5 T60,25 T100,10" fill="none" stroke="#C79A3D" strokeWidth="1.5" />
                       </svg>
                     </div>
                  </div>
                </div>
             </div>
          </div>

        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-[45%] p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin text-[#2563EB]" /></div>}>
            <LoginFormContent />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
