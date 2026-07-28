"use client";

import { useState, useEffect } from "react";
import { Search, ExternalLink, Star, GitFork, AlertCircle, Eye, Code2, Clock, GitCommit, Github, Info, ChevronRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RelativeTime } from "@/components/shared";

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

interface GithubTrackerProps {
  projectId: string;
  initialRepo: string;
  isAdmin: boolean;
}

export function GithubTracker({ projectId, initialRepo, isAdmin }: GithubTrackerProps) {
  const [url, setUrl] = useState(initialRepo ? `https://github.com/${initialRepo}` : "");
  const [repoPath, setRepoPath] = useState(initialRepo);
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
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
    }
  }, [initialRepo]);

  useEffect(() => {
    if (!repoPath) return;

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [repoRes, commitsRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${repoPath}`),
          fetch(`https://api.github.com/repos/${repoPath}/commits?per_page=5`)
        ]);

        if (!repoRes.ok) throw new Error("Repository not found or API limit reached.");
        
        const rData = await repoRes.json();
        const cData = commitsRes.ok ? await commitsRes.json() : [];

        if (isMounted) {
          setRepoData(rData);
          setCommits(cData);
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
    // Parse https://github.com/owner/repo
    try {
      if (path.includes("github.com/")) {
        const parts = new URL(path).pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          path = `${parts[0]}/${parts[1]}`;
        } else {
          throw new Error("Invalid format");
        }
      } else if (path.split("/").length === 2) {
        // Already in owner/repo format
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

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-8">
        
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
                    placeholder="https://github.com/Imaginum-org/Unideals"
                    className="w-full bg-[#131825] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !url.trim()}
                  className="bg-[#4338CA] text-white text-sm font-semibold px-6 py-3.5 rounded-xl hover:bg-[#4338CA]/90 transition-colors disabled:opacity-50 whitespace-nowrap shadow-md"
                >
                  Track Repository
                </button>
              </form>
              <div className="mt-4 flex items-center gap-2 text-muted-foreground text-xs relative z-10">
                <Info size={14} />
                <span>Enter any public GitHub repository URL to get started</span>
              </div>
              
              {/* Subtle gradient effect in background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#4338CA]/10 rounded-full blur-[80px] pointer-events-none transform translate-x-1/3 -translate-y-1/2"></div>
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
            {/* Repo Title & Meta Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-elevated border border-surface-border rounded-2xl p-6">
              <div className="space-y-3">
                <div className="h-7 w-48 bg-surface-border rounded-md"></div>
                <div className="h-4 w-64 sm:w-96 bg-surface-border rounded-md max-w-full"></div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-8 w-24 bg-surface-border rounded-lg"></div>
                <div className="h-8 w-32 bg-surface-border rounded-lg"></div>
              </div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-surface-elevated border border-surface-border rounded-2xl p-5 flex flex-col gap-3">
                  <div className="w-8 h-8 rounded-xl bg-surface-border"></div>
                  <div className="space-y-2 mt-1">
                    <div className="h-3 w-16 bg-surface-border rounded-md"></div>
                    <div className="h-5 w-12 bg-surface-border rounded-md"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Commits Skeleton */}
            <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6">
              <div className="h-5 w-32 bg-surface-border rounded-md mb-6"></div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-surface-border ring-4 ring-surface-border/50" />
                    </div>
                    <div className="space-y-2.5 flex-1">
                      <div className="h-4 w-3/4 sm:w-1/2 bg-surface-border rounded-md"></div>
                      <div className="h-3 w-32 bg-surface-border rounded-md"></div>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="relative overflow-hidden bg-gradient-to-r from-[#171336] to-[#141529] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-lg">
                <div className="flex items-center gap-5 z-10">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-[#4338CA] text-3xl font-extrabold tracking-tighter">U</span>
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
                            <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                            {repoData.language}
                          </div>
                          <span className="text-white/20">|</span>
                        </>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        Updated <RelativeTime date={new Date(repoData.updated_at)} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="z-10">
                  <button className="flex items-center gap-2 px-4 py-2 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl text-white text-sm font-medium transition-colors">
                    <Star size={16} />
                    Star
                  </button>
                </div>
                
                {/* Decorative background glow */}
                <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#4338CA]/20 rounded-full blur-[100px] pointer-events-none transform -translate-y-1/2"></div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Star} label="Stars" value={repoData.stargazers_count.toLocaleString()} color="text-yellow-500" bg="bg-yellow-500/10" border="border-yellow-500/20" glowColor="from-yellow-500/5" />
                <StatCard icon={GitFork} label="Forks" value={repoData.forks_count.toLocaleString()} color="text-emerald-500" bg="bg-emerald-500/10" border="border-emerald-500/20" glowColor="from-emerald-500/5" />
                <StatCard icon={AlertCircle} label="Open Issues" value={repoData.open_issues_count.toLocaleString()} color="text-rose-500" bg="bg-rose-500/10" border="border-rose-500/20" glowColor="from-rose-500/5" />
                <StatCard icon={Eye} label="Watchers" value={repoData.watchers_count.toLocaleString()} color="text-blue-500" bg="bg-blue-500/10" border="border-blue-500/20" glowColor="from-blue-500/5" />
              </div>

              {/* Recent Commits */}
              {commits.length > 0 && (
                <div className="bg-[#0F1421] border border-white/5 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-[15px] font-semibold text-white mb-6 flex items-center gap-2">
                    <GitCommit size={18} className="text-muted-foreground" />
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
                        
                      const avatarColors = [
                        "bg-[#7C3AED]", "bg-[#2563EB]", "bg-[#10B981]", "bg-[#F59E0B]", "bg-[#E11D48]"
                      ];
                      const avatarColor = avatarColors[idx % avatarColors.length];

                      return (
                        <div key={c.sha} className={`flex items-center gap-4 py-4 ${idx !== commits.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor}`}>
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
                              <span>{c.commit.author.name}</span>
                              <span>•</span>
                              <RelativeTime date={new Date(c.commit.author.date)} />
                            </div>
                          </div>
                          
                          <ChevronRight size={18} className="text-muted-foreground/50 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-6 text-center">
                    <a 
                      href={`${repoData.html_url}/commits`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#7C3AED] hover:text-[#7C3AED]/80 text-sm font-medium transition-colors"
                    >
                      View All Commits <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, border, glowColor }: { icon: any; label: string; value: string; color: string; bg: string; border: string; glowColor: string; }) {
  return (
    <div className={`bg-[#0F1421] border border-white/5 rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden group`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg} ${border} border`}>
        <Icon size={18} className={color} strokeWidth={2.5} />
      </div>
      <div className="z-10">
        <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
      </div>
      
      {/* Decorative gradient corner simulating the dot pattern */}
      <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-radial ${glowColor} to-transparent rounded-full opacity-40 group-hover:opacity-60 transition-opacity blur-xl`}></div>
    </div>
  );
}
