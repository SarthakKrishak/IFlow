"use client";

import { useState, useEffect } from "react";
import { Server, ExternalLink, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getDeploymentStatuses, DeploymentHealth } from "@/server/actions/deployments.actions";
import { Badge, Button, Card, Toolbar, buttonStyles, type Tone } from "@/components/ui";

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

  const statusTone = (status?: string): Tone =>
    status === "READY" ? "success" : status === "BUILDING" ? "warning" : status === "ERROR" ? "danger" : status === "QUEUED" ? "info" : "neutral";
  const statusLabel = (status?: string) =>
    status === "READY" ? "Live" : status === "BUILDING" ? "Building" : status === "ERROR" ? "Failed" : status === "QUEUED" ? "Queued" : "Unknown";
  const StatusIcon = ({ status }: { status?: string }) =>
    status === "READY" ? <CheckCircle2 size={13} /> : status === "BUILDING" ? <Loader2 size={13} className="animate-spin" /> : status === "ERROR" ? <XCircle size={13} /> : status === "QUEUED" ? <Clock size={13} /> : <Server size={13} />;

  type Deployment = NonNullable<DeploymentHealth["frontend"]>;
  const ServiceCard = ({
    name,
    platform,
    icon,
    dep,
    error,
    logsHref,
    logsLabel,
  }: {
    name: string;
    platform: string;
    icon: React.ReactNode;
    dep?: Deployment | null;
    error?: string;
    logsHref: string;
    logsLabel: string;
  }) => (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-border">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-foreground/[0.06] text-foreground flex items-center justify-center flex-shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold tracking-tight text-foreground">{name}</h3>
            <p className="text-[12.5px] text-muted-foreground">{platform}</p>
          </div>
        </div>
        <Badge tone={statusTone(dep?.status)} dot>
          <StatusIcon status={dep?.status} /> {statusLabel(dep?.status)}
        </Badge>
      </div>

      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.05] px-3 py-2.5 text-[12.5px] text-red-600 dark:text-red-400" role="alert">
          <XCircle size={14} className="shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
      <dl className="divide-y divide-surface-border text-[13px] flex-1">
        {[
          ["Project", dep?.projectName || "—"],
          ["Deployed", dep ? `${formatTimeAgo(dep.createdAt)} · ${new Date(dep.createdAt).toLocaleString()}` : "—"],
          ["Commit author", dep?.authorName || "—"],
          ["Commit message", dep?.commitMessage || "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-center gap-4 px-5 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-foreground text-right truncate max-w-[60%]" title={String(v)}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="p-4 border-t border-surface-border">
        <a href={logsHref} target="_blank" rel="noopener noreferrer" className={buttonStyles("secondary", "md", "w-full")}>
          <ExternalLink size={14} /> {logsLabel}
        </a>
      </div>
    </Card>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
      <Toolbar title="Current status" description={lastRefreshed ? `Last checked ${lastRefreshed.toLocaleTimeString()} · auto-refreshes every 15s` : "Checking…"}>
        <Button onClick={fetchHealth} loading={loading}>
          {!loading && <RefreshCw size={14} />} Refresh
        </Button>
      </Toolbar>

      {health && !health.configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-[13px]">
          <Server size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-semibold text-foreground">You’re viewing demo data</p>
            <p className="text-muted-foreground mt-1">Add your API tokens in the deployment environment settings to see live deployments:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1 text-muted-foreground">
              <li>
                <code className="font-mono text-foreground">VERCEL_TOKEN</code> and optionally <code className="font-mono text-foreground">VERCEL_PROJECT_ID</code>
              </li>
              <li>
                <code className="font-mono text-foreground">RAILWAY_TOKEN</code> and <code className="font-mono text-foreground">RAILWAY_PROJECT_ID</code>
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <ServiceCard
          name="Frontend"
          platform="Vercel Edge Network"
          dep={health?.frontend}
          error={health?.errors?.frontend}
          logsHref={health?.frontend?.url ?? "https://vercel.com/dashboard"}
          logsLabel={health?.frontend?.url ? "Open deployment" : "Open Vercel"}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3L22 19H2L12 3Z" fill="currentColor" />
            </svg>
          }
        />
        <ServiceCard
          name="Backend"
          platform="Railway container"
          dep={health?.backend}
          error={health?.errors?.backend}
          logsHref="https://railway.com/dashboard"
          logsLabel="View logs in Railway"
          icon={<Server size={20} />}
        />
      </div>
    </div>
  );
}
