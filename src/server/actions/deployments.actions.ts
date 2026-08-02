"use server";
import { unstable_noStore as noStore } from "next/cache";

export type DeploymentStatus = 'READY' | 'BUILDING' | 'ERROR' | 'QUEUED' | 'CANCELED';

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
}

// Fallback mock data when tokens are not configured
const MOCK_DATA: DeploymentHealth = {
  configured: false,
  frontend: {
    status: 'READY',
    url: 'https://iflow-app.vercel.app',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    commitMessage: 'feat: add deployment tracking widgets',
    authorName: 'Sarthak',
    projectName: 'iflow-frontend'
  },
  backend: {
    status: 'READY',
    url: 'https://iflow-api.railway.app',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    commitMessage: 'fix: optimize prisma queries',
    authorName: 'Sarthak',
    projectName: 'iflow-backend'
  }
};

export async function getDeploymentStatuses(): Promise<DeploymentHealth> {
  noStore();
  const vercelToken = process.env.VERCEL_TOKEN;
  const railwayToken = process.env.RAILWAY_TOKEN;

  // If no tokens configured, return beautiful mock data so the UI works
  if (!vercelToken && !railwayToken) {
    return {
      ...MOCK_DATA,
      frontend: {
        ...MOCK_DATA.frontend!,
        commitMessage: `DEBUG INFO: Vercel Token is ${vercelToken ? 'SET' : 'MISSING'}. Railway Token is ${railwayToken ? 'SET' : 'MISSING'}. Node Env: ${process.env.NODE_ENV}`
      }
    };
  }

  let frontend: DeploymentServiceInfo | null = null;
  let backend: DeploymentServiceInfo | null = null;

  try {
    if (vercelToken) {
      // Vercel Fetch (Assuming VERCEL_PROJECT_ID is provided, or we fetch the latest across the account)
      const projectId = process.env.VERCEL_PROJECT_ID;
      const url = projectId 
        ? `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`
        : `https://api.vercel.com/v6/deployments?limit=1`;
        
      const vRes = await fetch(url, {
        headers: { Authorization: `Bearer ${vercelToken}` },
        next: { revalidate: 15 } // Cache for 15 seconds
      });
      
      if (vRes.ok) {
        const data = await vRes.json();
        if (data.deployments && data.deployments.length > 0) {
          const d = data.deployments[0];
          frontend = {
            status: mapVercelStatus(d.state),
            url: d.url ? `https://${d.url}` : null,
            createdAt: new Date(d.created).toISOString(),
            commitMessage: d.meta?.githubCommitMessage || 'Manual Deployment',
            authorName: d.meta?.githubCommitAuthorName || 'Unknown',
            projectName: d.name
          };
        }
      }
    }
  } catch (err) {
    console.error("Vercel Fetch Error:", err);
  }

  try {
    if (railwayToken) {
      // Railway GraphQL Fetch
      // This requires RAILWAY_PROJECT_ID
      const projectId = process.env.RAILWAY_PROJECT_ID;
      if (projectId) {
        const query = `
          query {
            deployments(input: { projectId: "${projectId}", first: 1 }) {
              edges {
                node {
                  id
                  status
                  createdAt
                  staticUrl
                  meta {
                    commitMessage
                    commitAuthor
                  }
                }
              }
            }
          }
        `;
        const rRes = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${railwayToken}`
          },
          body: JSON.stringify({ query }),
          next: { revalidate: 15 }
        });
        
        if (rRes.ok) {
          const data = await rRes.json();
          const edges = data.data?.deployments?.edges;
          if (edges && edges.length > 0) {
            const d = edges[0].node;
            backend = {
              status: mapRailwayStatus(d.status),
              url: d.staticUrl ? `https://${d.staticUrl}` : null,
              createdAt: d.createdAt,
              commitMessage: d.meta?.commitMessage || 'Manual Deployment',
              authorName: d.meta?.commitAuthor || 'Unknown',
              projectName: 'Railway Backend'
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("Railway Fetch Error:", err);
  }

  return {
    configured: true,
    frontend: frontend || MOCK_DATA.frontend,
    backend: backend || MOCK_DATA.backend
  };
}

function mapVercelStatus(state: string): DeploymentStatus {
  switch(state) {
    case 'READY': return 'READY';
    case 'BUILDING': return 'BUILDING';
    case 'ERROR': return 'ERROR';
    case 'QUEUED': return 'QUEUED';
    case 'CANCELED': return 'CANCELED';
    default: return 'READY';
  }
}

function mapRailwayStatus(status: string): DeploymentStatus {
  switch(status) {
    case 'SUCCESS': return 'READY';
    case 'BUILDING': return 'BUILDING';
    case 'DEPLOYING': return 'BUILDING';
    case 'FAILED': return 'ERROR';
    case 'CRASHED': return 'ERROR';
    case 'QUEUED': return 'QUEUED';
    default: return 'READY';
  }
}
