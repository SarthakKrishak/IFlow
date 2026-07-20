import { cookies } from "next/headers";
import { prisma } from "./prisma";

const PROJECT_COOKIE = "iflow_active_project";

export async function getActiveProject() {
  const cookieStore = await cookies();
  const projectId = cookieStore.get(PROJECT_COOKIE)?.value;

  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) return project;
  }

  // Fallback to first project
  const firstProject = await prisma.project.findFirst({
    orderBy: { createdAt: "asc" }
  });

  return firstProject;
}
