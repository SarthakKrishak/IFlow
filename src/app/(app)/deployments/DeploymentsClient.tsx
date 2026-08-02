"use client";

import { useState, useEffect } from "react";
import { Server, ExternalLink, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getDeploymentStatuses, DeploymentHealth } from "@/server/actions/deployments.actions";

export function DeploymentsClient() {
  const [health, setHealth] = useState<DeploymentHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getDeploymentStatuses();
      setHealth(data);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Poll every 15s when on this page
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'READY': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'BUILDING': return <Loader2 className="text-orange-500 animate-spin" size={20} />;
      case 'ERROR': return <XCircle className="text-red-500" size={20} />;
      case 'QUEUED': return <Clock className="text-blue-500" size={20} />;
      default: return <Server className="text-zinc-500" size={20} />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'READY': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'BUILDING': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'ERROR': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'QUEUED': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-bold text-foreground">Current Status</h2>
        <div className="flex items-center gap-4 text-[13px] text-muted-foreground font-medium">
          {lastRefreshed && <span>Last checked: {lastRefreshed.toLocaleTimeString()}</span>}
          <button 
            onClick={fetchHealth} 
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-surface-border rounded-xl hover:bg-surface-border transition-colors disabled:opacity-50 text-foreground"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {!health?.configured && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[14px] p-4 rounded-2xl mb-8 flex items-start gap-3">
          <Server size={20} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-1 text-base">You are viewing Demo Data</strong>
            <p>To view your actual live deployments, you must configure your API tokens in your Vercel deployment settings.</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><code>VERCEL_TOKEN</code> and optionally <code>VERCEL_PROJECT_ID</code></li>
              <li><code>RAILWAY_TOKEN</code> and <code>RAILWAY_PROJECT_ID</code></li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend Detail Card */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3L22 19H2L12 3Z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Frontend</h3>
                <p className="text-sm text-muted-foreground">Vercel Edge Network</p>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${getStatusColor(health?.frontend?.status)}`}>
              {getStatusIcon(health?.frontend?.status)}
              {health?.frontend?.status || 'UNKNOWN'}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Project Name</span>
              <span className="text-[14px] font-semibold text-foreground">{health?.frontend?.projectName || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Deployed At</span>
              <span className="text-[14px] font-semibold text-foreground">
                {health?.frontend ? new Date(health.frontend.createdAt).toLocaleString() : '—'} 
                <span className="text-muted-foreground ml-2">({health?.frontend ? formatTimeAgo(health.frontend.createdAt) : ''})</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Commit Author</span>
              <span className="text-[14px] font-semibold text-foreground">{health?.frontend?.authorName || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Commit Message</span>
              <span className="text-[14px] font-semibold text-foreground max-w-[250px] truncate text-right">{health?.frontend?.commitMessage || '—'}</span>
            </div>

          </div>
          
          <div className="mt-8 flex gap-3">
             <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex-1 bg-surface-base border border-surface-border rounded-xl py-3 text-center text-[13px] font-bold text-foreground hover:bg-surface-border transition-colors">
               View Logs in Vercel
             </a>
          </div>
        </div>

        {/* Backend Detail Card */}
        <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0ZM12 21.6C17.302 21.6 21.6 17.302 21.6 12C21.6 6.69807 17.302 2.4 12 2.4C6.69807 2.4 2.4 6.69807 2.4 12C2.4 17.302 6.69807 21.6 12 21.6ZM13.2 14.4V19.2H10.8V14.4H13.2ZM13.2 4.8V9.6H10.8V4.8H13.2ZM9.6 13.2H4.8V10.8H9.6V13.2ZM19.2 13.2H14.4V10.8H19.2V13.2Z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Backend</h3>
                <p className="text-sm text-muted-foreground">Railway Docker Container</p>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${getStatusColor(health?.backend?.status)}`}>
              {getStatusIcon(health?.backend?.status)}
              {health?.backend?.status || 'UNKNOWN'}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Project Name</span>
              <span className="text-[14px] font-semibold text-foreground">{health?.backend?.projectName || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Deployed At</span>
              <span className="text-[14px] font-semibold text-foreground">
                {health?.backend ? new Date(health.backend.createdAt).toLocaleString() : '—'} 
                <span className="text-muted-foreground ml-2">({health?.backend ? formatTimeAgo(health.backend.createdAt) : ''})</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Commit Author</span>
              <span className="text-[14px] font-semibold text-foreground">{health?.backend?.authorName || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-border">
              <span className="text-[13px] text-muted-foreground font-medium">Commit Message</span>
              <span className="text-[14px] font-semibold text-foreground max-w-[250px] truncate text-right">{health?.backend?.commitMessage || '—'}</span>
            </div>

          </div>
          
          <div className="mt-8 flex gap-3">
             <a href="https://railway.app/dashboard" target="_blank" rel="noopener noreferrer" className="flex-1 bg-surface-base border border-surface-border rounded-xl py-3 text-center text-[13px] font-bold text-foreground hover:bg-surface-border transition-colors">
               View Logs in Railway
             </a>
          </div>
        </div>

      </div>
    </div>
  );
}
