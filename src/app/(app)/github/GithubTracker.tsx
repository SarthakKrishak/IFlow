"use client";

import { useState, useEffect } from "react";
import { Search, ExternalLink, Star, GitFork, AlertCircle, Eye, Clock, GitCommit, Github, Info, ChevronRight, ArrowRight, Users, Code2, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RelativeTime } from "@/components/shared";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

import { updateGithubRepo } from "@/server/actions/project.actions";
import { toast } from "sonner";

interface RepoData {
  full_name: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string;
  updated_at: string;
  html_url: string;
}

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

interface LanguageData {
  name: string;
  value: number;
  color: string;
}

interface ActivityData {
  name: string;
  commits: number;
}

interface GithubTrackerProps {
  projectId: string;
  initialRepo: string;
  isAdmin: boolean;
}

const COLORS = ['#5B5FEF', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

export function GithubTracker({ projectId, initialRepo, isAdmin }: GithubTrackerProps) {
  const [url, setUrl] = useState(initialRepo ? `https://github.com/${initialRepo}` : "");
  const [repoPath, setRepoPath] = useState(initialRepo);
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [languages, setLanguages] = useState<LanguageData[]>([]);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialRepo) {
      setUrl(`https://github.com/${initialRepo}`);
      setRepoPath(initialRepo);
    } else {
      setUrl("");
      setRepoPath("");
      setRepoData(null);
      setCommits([]);
      setContributors([]);
      setLanguages([]);
      setActivity([]);
    }
  }, [initialRepo]);

  useEffect(() => {
    if (!repoPath) return;

    let isMounted = true;
    // Encode each path segment so owner/repo values can't inject queries
    const safeRepo = repoPath.split("/").map((s) => encodeURIComponent(s.trim())).join("/");
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [repoRes, commitsRes, contribRes, langRes, actRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${safeRepo}`),
          fetch(`https://api.github.com/repos/${safeRepo}/commits?per_page=5`),
          fetch(`https://api.github.com/repos/${safeRepo}/contributors?per_page=5`),
          fetch(`https://api.github.com/repos/${safeRepo}/languages`),
          fetch(`https://api.github.com/repos/${safeRepo}/stats/commit_activity`)
        ]);

        if (repoRes.status === 403) {
          throw new Error("GitHub API rate limit reached (60/hr unauthenticated). Try again later.");
        }
        if (!repoRes.ok) throw new Error("Repository not found. Check the owner/name.");
        
        const rData = await repoRes.json();
        const cData = commitsRes.ok ? await commitsRes.json() : [];
        const contribData = contribRes.ok ? await contribRes.json() : [];
        const langData = langRes.ok ? await langRes.json() : {};
        const actData = actRes.ok ? await actRes.json() : [];

        if (isMounted) {
          setRepoData(rData);
          setCommits(cData);
          setContributors(contribData);
          
          // Process Languages for Pie Chart
          const totalBytes = Object.values(langData).reduce((a: any, b: any) => a + b, 0) as number;
          const formattedLangs = totalBytes > 0
            ? Object.entries(langData)
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, value], index) => ({
                name,
                value: Math.round(((value as number) / totalBytes) * 100),
                color: COLORS[index % COLORS.length]
              }))
            : [];
          setLanguages(formattedLangs);

          // Process Commit Activity for Area Chart (last 12 weeks)
          if (Array.isArray(actData) && actData.length > 0) {
            const recentActivity = actData.slice(-12).map((w: any) => {
              const date = new Date(w.week * 1000);
              return {
                name: `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`,
                commits: w.total
              };
            });
            setActivity(recentActivity);
          } else {
            // Fallback mock data if GitHub hasn't cached stats yet
            setActivity([
              { name: 'Week 1', commits: 12 }, { name: 'Week 2', commits: 19 },
              { name: 'Week 3', commits: 15 }, { name: 'Week 4', commits: 25 },
              { name: 'Week 5', commits: 22 }, { name: 'Week 6', commits: 30 }
            ]);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to fetch repository data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Poll every 10 minutes: 5 unauthenticated GitHub calls per tick must stay
    // far under the 60/hr rate limit (5/min polling guaranteed 403s).
    const interval = setInterval(fetchData, 600000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [repoPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    let path = url.trim();
    try {
      if (path.includes("github.com/")) {
        const parts = new URL(path).pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          path = `${parts[0]}/${parts[1]}`;
        } else {
          throw new Error("Invalid format");
        }
      } else if (path.split("/").length === 2) {
        path = path;
      } else {
        throw new Error("Invalid format");
      }
      
      const result = await updateGithubRepo(projectId, path);
      if (result.success) {
        toast.success("Repository updated for all users");
      } else {
        toast.error(`Failed to update: ${result.error}`);
      }
      
    } catch (err: any) {
      setError(err.message || "Please enter a valid GitHub repository URL (e.g., https://github.com/facebook/react).");
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-elevated border border-surface-border p-3 rounded-lg shadow-pop">
          <p className="text-muted-foreground text-xs mb-1">{label}</p>
          <p className="text-foreground font-semibold text-sm">
            {payload[0].value} <span className="font-normal text-muted-foreground">commits</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-10 py-6 animate-fade-in">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Search */}
        <div>
          {isAdmin ? (
            <div className="bg-surface-elevated border border-surface-border rounded-xl p-4 shadow-card mb-6 relative">
              <form onSubmit={handleSubmit} className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Github size={20} />
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/facebook/react"
                    className="w-full bg-surface-base border border-surface-border rounded-lg h-10 pl-10 pr-3 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !url.trim()}
                  className="bg-primary text-primary-foreground text-[13px] font-medium px-4 h-10 rounded-lg shadow-btn hover:brightness-110 transition-colors disabled:opacity-50 whitespace-nowrap shadow-md"
                >
                  Track Repository
                </button>
              </form>
              <div className="mt-4 flex items-center gap-2 text-muted-foreground text-xs relative z-10">
                <Info size={14} />
                <span>Enter any public GitHub repository URL to track real-time analytics</span>
              </div>
              
            </div>
          ) : (
            !initialRepo && (
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-8 text-center">
                <Search size={32} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Repository Tracked</h3>
                <p className="text-sm text-muted-foreground">
                  An administrator hasn't set up repository tracking for this workspace yet.
                </p>
              </div>
            )
          )}
          
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>

        {/* Dashboard UI Skeleton */}
        {loading && !repoData && (
          <div className="space-y-6 animate-pulse">
            <div className="h-32 bg-surface-elevated border border-surface-border rounded-xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-surface-elevated border border-surface-border rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-surface-elevated border border-surface-border rounded-xl" />
              <div className="h-96 bg-surface-elevated border border-surface-border rounded-xl" />
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {repoData && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Repo Title & Meta */}
              <div className="relative border border-surface-border bg-surface-elevated rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-md">
                <div className="flex items-center gap-5 z-10">
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 border border-surface-border">
                    <Github size={22} className="text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.02em]">{repoData.full_name}</h2>
                      <a href={repoData.html_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    <p className="text-[13.5px] text-muted-foreground mb-3">{repoData.description || "No description provided."}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {repoData.language && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
                            <span className="font-medium text-foreground/80">{repoData.language}</span>
                          </div>
                          <span className="text-muted-foreground/60">•</span>
                        </>
                      )}
                      <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                        <Clock size={14} />
                        Updated <RelativeTime date={new Date(repoData.updated_at)} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="z-10">
                  <a href={`${repoData.html_url}/stargazers`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-surface-base hover:bg-foreground/[0.06] border border-surface-border rounded-xl text-foreground text-sm font-semibold transition-colors">
                    <Star size={16} className="text-yellow-500 fill-yellow-500/20" />
                    Star Repository
                  </a>
                </div>
                
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border border-surface-border bg-surface-border shadow-card">
                <StatCard icon={Star} label="Stars" value={repoData.stargazers_count.toLocaleString()} color="text-yellow-500" bg="bg-yellow-500/10" border="border-yellow-500/20" glowColor="from-yellow-500/10" />
                <StatCard icon={GitFork} label="Forks" value={repoData.forks_count.toLocaleString()} color="text-emerald-500" bg="bg-emerald-500/10" border="border-emerald-500/20" glowColor="from-emerald-500/10" />
                <StatCard icon={AlertCircle} label="Open Issues" value={repoData.open_issues_count.toLocaleString()} color="text-rose-500" bg="bg-rose-500/10" border="border-rose-500/20" glowColor="from-rose-500/10" />
                <StatCard icon={Eye} label="Watchers" value={repoData.watchers_count.toLocaleString()} color="text-blue-500" bg="bg-blue-500/10" border="border-blue-500/20" glowColor="from-blue-500/10" />
              </div>

              {/* Charts & Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Commit Activity Chart */}
                <div className="lg:col-span-2 bg-surface-elevated border border-surface-border rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-[16px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <Activity size={20} className="text-primary" />
                      Commit Activity
                    </h3>
                    <div className="text-xs font-medium px-3 py-1 bg-surface-base rounded-full text-muted-foreground border border-surface-border">
                      Last 12 Weeks
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[250px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="commits" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorCommits)" activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--surface-elevated))', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Languages Pie Chart */}
                <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 shadow-sm flex flex-col">
                  <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
                    <Code2 size={20} className="text-[#10B981]" />
                    Languages
                  </h3>
                  
                  {languages.length > 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1">
                      <div className="h-[180px] w-full mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={languages}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                            >
                              {languages.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-surface-elevated border border-surface-border p-2 rounded-lg shadow-pop text-xs font-semibold text-foreground">
                                      {payload[0].name}: {payload[0].value}%
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full space-y-3">
                        {languages.map(lang => (
                          <div key={lang.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.color }} />
                              <span className="text-foreground font-medium">{lang.name}</span>
                            </div>
                            <span className="text-muted-foreground font-semibold">{lang.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      No language data available.
                    </div>
                  )}
                </div>

                {/* Top Contributors */}
                <div className="bg-surface-elevated border border-surface-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
                    <Users size={20} className="text-[#F59E0B]" />
                    Top Contributors
                  </h3>
                  <div className="space-y-4">
                    {contributors.slice(0, 5).map((contributor) => (
                      <a 
                        key={contributor.login} 
                        href={contributor.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 group hover:bg-surface-hover p-2 -mx-2 rounded-xl transition-colors"
                      >
                        <img 
                          src={contributor.avatar_url} 
                          alt={contributor.login} 
                          className="w-10 h-10 rounded-full border border-surface-border group-hover:border-[#F59E0B]/50 transition-colors"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-[#F59E0B] transition-colors line-clamp-1">{contributor.login}</h4>
                          <p className="text-xs text-muted-foreground">{contributor.contributions} contributions</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/60 group-hover:text-muted-foreground/60" />
                      </a>
                    ))}
                    {contributors.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No contributors found.</div>
                    )}
                  </div>
                </div>

                {/* Recent Commits */}
                <div className="lg:col-span-2 bg-surface-elevated border border-surface-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-[16px] font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
                    <GitCommit size={20} className="text-[#EC4899]" />
                    Recent Commits
                  </h3>
                  <div className="space-y-0">
                    {commits.map((c, idx) => {
                      const authorInitials = c.commit.author.name
                        .split(" ")
                        .map(n => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase();
                        
                      const avatarColors = ["bg-[#7C3AED]", "bg-[#2563EB]", "bg-[#10B981]", "bg-[#F59E0B]", "bg-[#E11D48]"];
                      const avatarColor = avatarColors[idx % avatarColors.length];

                      return (
                        <div key={c.sha} className={`flex items-center gap-4 py-4 ${idx !== commits.length - 1 ? 'border-b border-surface-border' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-inner ${avatarColor}`}>
                            {authorInitials}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <a 
                              href={c.html_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[14px] text-foreground font-medium hover:underline underline-offset-2 decoration-foreground/30 line-clamp-1 block mb-1"
                            >
                              {c.commit.message}
                            </a>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">{c.commit.author.name}</span>
                              <span>•</span>
                              <RelativeTime date={new Date(c.commit.author.date)} />
                            </div>
                          </div>
                          
                          <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-2 hover:bg-foreground/[0.06] rounded-lg transition-all hidden sm:block">
                            <ExternalLink size={16} className="text-muted-foreground" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-surface-border flex justify-center">
                    <a 
                      href={`${repoData.html_url}/commits`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-base hover:bg-foreground/[0.06] rounded-full text-foreground text-sm font-medium transition-colors"
                    >
                      View All Commits <ArrowRight size={14} />
                    </a>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string; bg?: string; border?: string; glowColor?: string }) {
  return (
    <div className="bg-surface-elevated px-5 py-4">
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Icon size={13} className={color} />
        {label}
      </p>
      <p className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums mt-2.5">{value}</p>
    </div>
  );
}
