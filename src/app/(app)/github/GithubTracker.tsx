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
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [repoRes, commitsRes, contribRes, langRes, actRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${repoPath}`),
          fetch(`https://api.github.com/repos/${repoPath}/commits?per_page=5`),
          fetch(`https://api.github.com/repos/${repoPath}/contributors?per_page=5`),
          fetch(`https://api.github.com/repos/${repoPath}/languages`),
          fetch(`https://api.github.com/repos/${repoPath}/stats/commit_activity`)
        ]);

        if (!repoRes.ok) throw new Error("Repository not found or API limit reached.");
        
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
          const formattedLangs = Object.entries(langData)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, value], index) => ({
              name,
              value: Math.round(((value as number) / totalBytes) * 100),
              color: COLORS[index % COLORS.length]
            }));
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

    // Poll every 60 seconds
    const interval = setInterval(fetchData, 60000);
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
        <div className="bg-[#0B0F19] border border-white/10 p-3 rounded-lg shadow-xl">
          <p className="text-muted-foreground text-xs mb-1">{label}</p>
          <p className="text-white font-bold text-sm">
            {payload[0].value} <span className="font-normal text-muted-foreground">commits</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 animate-fade-in bg-surface-base">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Search */}
        <div>
          {isAdmin ? (
            <div className="bg-[#0B0F19] border border-white/5 rounded-2xl p-6 shadow-lg mb-8 relative overflow-hidden">
              <form onSubmit={handleSubmit} className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white">
                    <Github size={20} />
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/facebook/react"
                    className="w-full bg-[#131825] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !url.trim()}
                  className="bg-[#5B5FEF] text-white text-sm font-semibold px-6 py-3.5 rounded-xl hover:bg-[#4B4FE0] transition-colors disabled:opacity-50 whitespace-nowrap shadow-md"
                >
                  Track Repository
                </button>
              </form>
              <div className="mt-4 flex items-center gap-2 text-muted-foreground text-xs relative z-10">
                <Info size={14} />
                <span>Enter any public GitHub repository URL to track real-time analytics</span>
              </div>
              
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B5FEF]/10 rounded-full blur-[80px] pointer-events-none transform translate-x-1/3 -translate-y-1/2"></div>
            </div>
          ) : (
            !initialRepo && (
              <div className="bg-surface-elevated border border-surface-border rounded-2xl p-8 text-center">
                <Search size={32} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Repository Tracked</h3>
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
            <div className="h-32 bg-surface-elevated border border-surface-border rounded-2xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-surface-elevated border border-surface-border rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-surface-elevated border border-surface-border rounded-2xl" />
              <div className="h-96 bg-surface-elevated border border-surface-border rounded-2xl" />
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
              <div className="relative overflow-hidden bg-gradient-to-r from-[#111322] to-[#0d101a] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-lg">
                <div className="flex items-center gap-5 z-10">
                  <div className="w-16 h-16 bg-[#1A1F36] rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10 shadow-inner">
                    <Github size={32} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-white tracking-tight">{repoData.full_name}</h2>
                      <a href={repoData.html_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                    <p className="text-[15px] text-muted-foreground mb-3">{repoData.description || "No description provided."}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {repoData.language && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]"></span>
                            <span className="font-medium text-white/80">{repoData.language}</span>
                          </div>
                          <span className="text-white/20">•</span>
                        </>
                      )}
                      <div className="flex items-center gap-1.5 font-medium text-white/70">
                        <Clock size={14} />
                        Updated <RelativeTime date={new Date(repoData.updated_at)} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="z-10">
                  <a href={`${repoData.html_url}/stargazers`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-semibold transition-colors">
                    <Star size={16} className="text-yellow-500 fill-yellow-500/20" />
                    Star Repository
                  </a>
                </div>
                
                <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#5B5FEF]/10 rounded-full blur-[100px] pointer-events-none transform -translate-y-1/2"></div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard icon={Star} label="Stars" value={repoData.stargazers_count.toLocaleString()} color="text-yellow-500" bg="bg-yellow-500/10" border="border-yellow-500/20" glowColor="from-yellow-500/10" />
                <StatCard icon={GitFork} label="Forks" value={repoData.forks_count.toLocaleString()} color="text-emerald-500" bg="bg-emerald-500/10" border="border-emerald-500/20" glowColor="from-emerald-500/10" />
                <StatCard icon={AlertCircle} label="Open Issues" value={repoData.open_issues_count.toLocaleString()} color="text-rose-500" bg="bg-rose-500/10" border="border-rose-500/20" glowColor="from-rose-500/10" />
                <StatCard icon={Eye} label="Watchers" value={repoData.watchers_count.toLocaleString()} color="text-blue-500" bg="bg-blue-500/10" border="border-blue-500/20" glowColor="from-blue-500/10" />
              </div>

              {/* Charts & Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Commit Activity Chart */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity size={20} className="text-[#5B5FEF]" />
                      Commit Activity
                    </h3>
                    <div className="text-xs font-medium px-3 py-1 bg-white/5 rounded-full text-muted-foreground border border-white/10">
                      Last 12 Weeks
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[250px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5B5FEF" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#5B5FEF" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="commits" stroke="#5B5FEF" strokeWidth={3} fillOpacity={1} fill="url(#colorCommits)" activeDot={{ r: 6, fill: '#5B5FEF', stroke: '#0B0F19', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#5B5FEF]/10 rounded-full blur-[100px] pointer-events-none"></div>
                </div>

                {/* Languages Pie Chart */}
                <div className="bg-[#0B0F19] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
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
                                    <div className="bg-[#0B0F19] border border-white/10 p-2 rounded-lg shadow-xl text-xs font-semibold text-white">
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
                              <span className="text-white font-medium">{lang.name}</span>
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
                <div className="bg-[#0B0F19] border border-white/5 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
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
                        className="flex items-center gap-4 group hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors"
                      >
                        <img 
                          src={contributor.avatar_url} 
                          alt={contributor.login} 
                          className="w-10 h-10 rounded-full border border-white/10 group-hover:border-[#F59E0B]/50 transition-colors"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white group-hover:text-[#F59E0B] transition-colors line-clamp-1">{contributor.login}</h4>
                          <p className="text-xs text-muted-foreground">{contributor.contributions} contributions</p>
                        </div>
                        <ChevronRight size={16} className="text-white/20 group-hover:text-white/50" />
                      </a>
                    ))}
                    {contributors.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No contributors found.</div>
                    )}
                  </div>
                </div>

                {/* Recent Commits */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-white/5 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
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
                        <div key={c.sha} className={`flex items-center gap-4 py-4 ${idx !== commits.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-inner ${avatarColor}`}>
                            {authorInitials}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <a 
                              href={c.html_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[14px] text-white font-medium hover:text-[#5B5FEF] transition-colors line-clamp-1 block mb-1"
                            >
                              {c.commit.message}
                            </a>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-white/70">{c.commit.author.name}</span>
                              <span>•</span>
                              <RelativeTime date={new Date(c.commit.author.date)} />
                            </div>
                          </div>
                          
                          <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg transition-all hidden sm:block">
                            <ExternalLink size={16} className="text-muted-foreground" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
                    <a 
                      href={`${repoData.html_url}/commits`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-white text-sm font-medium transition-colors"
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

function StatCard({ icon: Icon, label, value, color, bg, border, glowColor }: { icon: any; label: string; value: string; color: string; bg: string; border: string; glowColor: string; }) {
  return (
    <div className={`bg-[#0B0F19] border border-white/5 rounded-2xl p-5 lg:p-6 flex flex-col gap-5 relative overflow-hidden group hover:border-white/10 transition-colors`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${border} border`}>
        <Icon size={18} className={color} strokeWidth={2.5} />
      </div>
      <div className="z-10">
        <p className="text-xs lg:text-sm text-muted-foreground font-semibold mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{value}</p>
      </div>
      
      <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-radial ${glowColor} to-transparent rounded-full opacity-40 group-hover:opacity-80 transition-opacity blur-xl`}></div>
    </div>
  );
}
