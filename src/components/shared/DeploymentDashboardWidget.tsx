"use client";

import { useState, useEffect } from "react";
import { Server, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { getDeploymentStatuses, DeploymentHealth } from "@/server/actions/deployments.actions";

export function DeploymentDashboardWidget() {
  const [health, setHealth] = useState<DeploymentHealth | null>(null);
  const [loading, setLoading] = useState(true);

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
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
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
      case 'READY': return 'bg-emerald-500 text-emerald-500';
      case 'BUILDING': return 'bg-orange-500 text-orange-500';
      case 'ERROR': return 'bg-red-500 text-red-500';
      default: return 'bg-zinc-500 text-zinc-500';
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

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-3xl p-6 shadow-sm flex flex-col h-[380px] lg:h-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[17px] font-bold text-foreground">System Health</h2>
        {loading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
      </div>
      
      {!health?.configured && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[12px] p-3 rounded-xl mb-4">
          <strong>Demo Mode:</strong> Add VERCEL_TOKEN and RAILWAY_TOKEN to .env
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center space-y-5">
        {/* Frontend */}
        <div className="bg-surface-base border border-surface-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center">
                <Server size={20} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-foreground">Frontend</h3>
                <p className="text-[11px] text-muted-foreground">Vercel Edge</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-[12px] font-bold uppercase ${getStatusColor(health?.frontend?.status).split(' ')[1]}`}>
                {getStatusText(health?.frontend?.status)}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {health?.frontend ? formatTimeAgo(health.frontend.createdAt) : ''}
              </span>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-[12px] font-medium text-foreground line-clamp-1 mb-1">{health?.frontend?.commitMessage}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">by {health?.frontend?.authorName}</span>
            </div>
          </div>
        </div>

        {/* Backend */}
        <div className="bg-surface-base border border-surface-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Server size={20} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-foreground">Backend</h3>
                <p className="text-[11px] text-muted-foreground">Railway Container</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-[12px] font-bold uppercase ${getStatusColor(health?.backend?.status).split(' ')[1]}`}>
                {getStatusText(health?.backend?.status)}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {health?.backend ? formatTimeAgo(health.backend.createdAt) : ''}
              </span>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-[12px] font-medium text-foreground line-clamp-1 mb-1">{health?.backend?.commitMessage}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">by {health?.backend?.authorName}</span>
            </div>
          </div>
        </div>
      </div>
      
      <Link href="/deployments" className="text-[13px] font-semibold text-primary mt-6 inline-block hover:underline text-center w-full">
        View All Deployments &rarr;
      </Link>
    </div>
  );
}
