"use server";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/auth";

export type DeploymentStatus = "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED";

export interface DeploymentServiceInfo {
  status: DeploymentStatus;
  url: string | null;
  createdAt: string;
  commitMessage: string;
  authorName: string;
  projectName: string;
}

export interface DeploymentHealth {
  configured: boolean;
  frontend: DeploymentServiceInfo | null;
  backend: DeploymentServiceInfo | null;
  /** Why a service couldn't be loaded — shown in the UI so misconfiguration is visible, not silent. */
  errors?: { frontend?: string; backend?: string };
}

// Fallback demo data when no tokens are configured at all.
const MOCK_DATA: DeploymentHealth = {
  configured: false,
  frontend: {
    status: "READY",
    url: "https://iflow-app.vercel.app",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    commitMessage: "feat: add deployment tracking widgets",
    authorName: "Sarthak",
    projectName: "iflow-frontend",
  },
  backend: {
    status: "READY",
    url: "https://iflow-api.railway.app",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    commitMessage: "fix: optimize prisma queries",
    authorName: "Sarthak",
    projectName: "iflow-backend",
  },
};

const TIMEOUT_MS = 8000;

class ServiceError extends Error {}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, body };
}

export async function getDeploymentStatuses(): Promise<DeploymentHealth> {
  noStore();
  const session = await auth();
  if (!session?.user?.id) return { configured: false, frontend: null, backend: null };

  const vercelToken = process.env.VERCEL_TOKEN?.trim();
  const railwayToken = process.env.RAILWAY_TOKEN?.trim();
  if (!vercelToken && !railwayToken) return MOCK_DATA;

  const errors: NonNullable<DeploymentHealth["errors"]> = {};
  const [frontend, backend] = await Promise.all([
    vercelToken
      ? getVercel(vercelToken).catch((e) => {
          errors.frontend = message(e);
          console.error("[deployments] Vercel:", errors.frontend);
          return null;
        })
      : Promise.resolve(null),
    railwayToken
      ? getRailway(railwayToken).catch((e) => {
          errors.backend = message(e);
          console.error("[deployments] Railway:", errors.backend);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return { configured: true, frontend, backend, errors: errors.frontend || errors.backend ? errors : undefined };
}

function message(e: unknown): string {
  if (e instanceof ServiceError) return e.message;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return "Timed out reaching the API";
  return e instanceof Error ? e.message : "Unknown error";
}

// ── Vercel ─────────────────────────────────────────────────────────────────

// Team id discovered once per server instance (projects under a Vercel team need ?teamId=).
let discoveredVercelTeam: string | null | undefined;

async function getVercel(token: string): Promise<DeploymentServiceInfo | null> {
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const headers = { Authorization: `Bearer ${token}` };

  const list = async (teamId: string | null) => {
    const q = new URLSearchParams({ limit: "1", target: "production" });
    if (projectId) q.set("projectId", projectId);
    if (teamId) q.set("teamId", teamId);
    return fetchJson(`https://api.vercel.com/v6/deployments?${q}`, { headers });
  };

  // 1) Explicit team, 2) previously discovered team, 3) personal scope.
  const explicitTeam = process.env.VERCEL_TEAM_ID?.trim() || null;
  let teamId = explicitTeam ?? discoveredVercelTeam ?? null;
  let res = await list(teamId);

  // Project lives in a team the token can see, but no team id was given: find it.
  if (!explicitTeam && (res.status === 403 || res.status === 404 || (res.status === 200 && !res.body?.deployments?.length))) {
    const teams = await fetchJson("https://api.vercel.com/v2/teams?limit=50", { headers });
    for (const t of teams.body?.teams ?? []) {
      const attempt = await list(t.id);
      if (attempt.status === 200 && attempt.body?.deployments?.length) {
        res = attempt;
        teamId = t.id;
        discoveredVercelTeam = t.id;
        break;
      }
    }
  }

  if (res.status === 401 || res.status === 403) {
    throw new ServiceError(
      `Vercel rejected the token (${res.status}). Create a token with access to the team that owns this project and set VERCEL_TOKEN${explicitTeam ? "" : " (and optionally VERCEL_TEAM_ID)"}.`
    );
  }
  if (res.status === 404) throw new ServiceError("Vercel couldn't find that project — check VERCEL_PROJECT_ID (prj_…) and VERCEL_TEAM_ID.");
  if (res.status !== 200) throw new ServiceError(`Vercel API error ${res.status}: ${res.body?.error?.message ?? "unexpected response"}`);

  const d = res.body?.deployments?.[0];
  if (!d) {
    throw new ServiceError(
      projectId
        ? "No production deployments found for VERCEL_PROJECT_ID. Check the id (Project → Settings → General) and that the token's team owns it."
        : "No deployments found. Set VERCEL_PROJECT_ID to the project's id."
    );
  }
  return {
    status: mapVercelStatus(d.state ?? d.readyState),
    url: d.url ? `https://${d.url}` : null,
    createdAt: new Date(d.created ?? d.createdAt).toISOString(),
    commitMessage: d.meta?.githubCommitMessage || d.meta?.gitlabCommitMessage || "Manual deployment",
    authorName: d.meta?.githubCommitAuthorName || d.meta?.githubCommitAuthorLogin || d.creator?.username || "Unknown",
    projectName: d.name,
  };
}

// ── Railway ────────────────────────────────────────────────────────────────

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const RAILWAY_QUERY = `
  query Deployments($input: DeploymentListInput!) {
    deployments(first: 1, input: $input) {
      edges { node { id status createdAt staticUrl url meta } }
    }
  }
`;

async function getRailway(token: string): Promise<DeploymentServiceInfo | null> {
  const projectId = process.env.RAILWAY_PROJECT_ID?.trim();
  if (!projectId) throw new ServiceError("RAILWAY_PROJECT_ID is not set (Project → Settings → General → Project ID).");

  const input: Record<string, string> = { projectId };
  const serviceId = process.env.RAILWAY_SERVICE_ID?.trim();
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim();
  if (serviceId) input.serviceId = serviceId;
  if (environmentId) input.environmentId = environmentId;
  const body = JSON.stringify({ query: RAILWAY_QUERY, variables: { input } });

  // Account/team tokens use Bearer; project tokens use Project-Access-Token. Try both.
  const call = (header: Record<string, string>) =>
    fetchJson(RAILWAY_API, { method: "POST", headers: { "Content-Type": "application/json", ...header }, body });

  let res = await call({ Authorization: `Bearer ${token}` });
  if (isRailwayAuthError(res)) {
    const asProjectToken = await call({ "Project-Access-Token": token });
    if (!isRailwayAuthError(asProjectToken)) res = asProjectToken;
  }

  if (isRailwayAuthError(res)) {
    throw new ServiceError("Railway rejected RAILWAY_TOKEN. Use an account/team token (Account → Tokens) or a project token for this project.");
  }
  const gqlError = res.body?.errors?.[0]?.message;
  if (gqlError) throw new ServiceError(`Railway: ${gqlError}`);
  if (res.status !== 200) throw new ServiceError(`Railway API error ${res.status}`);

  const d = res.body?.data?.deployments?.edges?.[0]?.node;
  if (!d) throw new ServiceError("No deployments found for RAILWAY_PROJECT_ID. Check the id, or set RAILWAY_SERVICE_ID for the service to track.");
  const meta = (d.meta ?? {}) as Record<string, any>;
  const host = d.staticUrl || d.url;
  return {
    status: mapRailwayStatus(d.status),
    url: host ? (host.startsWith("http") ? host : `https://${host}`) : null,
    createdAt: d.createdAt,
    commitMessage: meta.commitMessage || "Manual deployment",
    authorName: meta.commitAuthor || "Unknown",
    projectName: meta.serviceName || "Railway backend",
  };
}

function isRailwayAuthError(res: { status: number; body: any }) {
  if (res.status === 401 || res.status === 403) return true;
  const msg: string = res.body?.errors?.[0]?.message ?? "";
  return /not authori[sz]ed|unauthori[sz]ed|invalid token/i.test(msg);
}

function mapVercelStatus(state: string): DeploymentStatus {
  switch (state) {
    case "READY":
      return "READY";
    case "BUILDING":
    case "INITIALIZING":
      return "BUILDING";
    case "ERROR":
      return "ERROR";
    case "CANCELED":
      return "CANCELED";
    default:
      return "QUEUED";
  }
}

function mapRailwayStatus(status: string): DeploymentStatus {
  switch (status) {
    case "SUCCESS":
      return "READY";
    case "BUILDING":
    case "DEPLOYING":
    case "INITIALIZING":
      return "BUILDING";
    case "FAILED":
    case "CRASHED":
      return "ERROR";
    case "REMOVED":
    case "SKIPPED":
      return "CANCELED";
    default:
      return "QUEUED";
  }
}
