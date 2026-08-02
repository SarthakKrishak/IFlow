"use client";

import { useState, useEffect, useRef } from "react";
import { Server, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getDeploymentStatuses, DeploymentHealth } from "@/server/actions/deployments.actions";

export function DeploymentIndicator() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<DeploymentHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getDeploymentStatuses();
      setHealth(data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'READY': return 'bg-emerald-500';
      case 'BUILDING': return 'bg-orange-500';
      case 'ERROR': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'READY': return 'Live';
      case 'BUILDING': return 'Building';
      case 'ERROR': return 'Failed';
      default: return 'Unknown';
    }
  };

  // Determine overall status for the top indicator
  let overallColor = 'bg-zinc-500';
  let isBuilding = false;
  if (health) {
    if (health.frontend?.status === 'ERROR' || health.backend?.status === 'ERROR') {
      overallColor = 'bg-red-500';
    } else if (health.frontend?.status === 'BUILDING' || health.backend?.status === 'BUILDING') {
      overallColor = 'bg-orange-500';
      isBuilding = true;
    } else {
      overallColor = 'bg-emerald-500';
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors"
      >
        <Server size={16} strokeWidth={2} />
        {health && (
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-surface-base ${overallColor} ${isBuilding ? 'animate-pulse' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-surface-elevated border border-surface-border rounded-2xl shadow-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-5 py-4 border-b border-surface-border bg-surface-base flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
              System Health
              {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            </h3>
            <button onClick={fetchHealth} className="text-muted-foreground hover:text-foreground">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {!health?.configured && (
              <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[12px] p-3 rounded-xl">
                <strong>Demo Mode:</strong> Add VERCEL_TOKEN and RAILWAY_TOKEN to your .env to see your actual live deployments.
              </div>
            )}

            {/* Frontend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(health?.frontend?.status)}`} />
                  <span className="text-[13px] font-bold text-foreground">Frontend (Vercel)</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {health?.frontend ? formatTimeAgo(health.frontend.createdAt) : ''}
                </span>
              </div>
              <div className="bg-surface-base border border-surface-border rounded-xl p-3">
                <p className="text-[12px] font-medium text-foreground line-clamp-1">{health?.frontend?.commitMessage}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">{health?.frontend?.authorName}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase ${getStatusColor(health?.frontend?.status).replace('bg-', 'text-')}`}>
                      {getStatusText(health?.frontend?.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Backend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(health?.backend?.status)}`} />
                  <span className="text-[13px] font-bold text-foreground">Backend (Railway)</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {health?.backend ? formatTimeAgo(health.backend.createdAt) : ''}
                </span>
              </div>
              <div className="bg-surface-base border border-surface-border rounded-xl p-3">
                <p className="text-[12px] font-medium text-foreground line-clamp-1">{health?.backend?.commitMessage}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">{health?.backend?.authorName}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase ${getStatusColor(health?.backend?.status).replace('bg-', 'text-')}`}>
                      {getStatusText(health?.backend?.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2 bg-surface-base border-t border-surface-border">
            <Link 
              href="/deployments" 
              onClick={() => setOpen(false)}
              className="block w-full text-center py-2 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              View All Deployments
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
