"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import type { Project } from "@prisma/client";
import { revalidateProjectsCache, revalidateBoardsCache } from "@/lib/cached";

type Result<T> = { success: true; data: T } | { success: false; error: string };

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `project-${Date.now()}`;
}

export async function createProject(data: { name: string; description?: string }): Promise<Result<Project>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN) return { success: false, error: "Admin only" };

    const name = data.name?.trim();
    if (!name) return { success: false, error: "Project name is required" };

    let slug = slugify(name);
    const existing = await prisma.project.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const project = await prisma.project.create({
      data: {
        name,
        description: data.description?.trim() || undefined,
        slug,
        boards: {
          create: [
            {
              name: "Dev Board",
              slug: `${slug}-dev`,
              department: "DEV",
              columns: {
                create: [
                  { name: "To Do", order: 0 },
                  { name: "In Progress", order: 1 },
                  { name: "Done", order: 2 },
                ],
              },
            },
            {
              name: "Design Board",
              slug: `${slug}-design`,
              department: "DESIGN",
              columns: {
                create: [
                  { name: "To Do", order: 0 },
                  { name: "In Progress", order: 1 },
                  { name: "Done", order: 2 },
                ],
              },
            },
          ],
        },
      },
    });

    revalidatePath("/");
    revalidateProjectsCache();
    revalidateBoardsCache();
    return { success: true, data: project };
  } catch (error) {
    console.error("createProject error:", error);
    return { success: false, error: "Failed to create project" };
  }
}

export async function updateGithubRepo(projectId: string, githubRepo: string | null): Promise<Result<Project>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (session.user.role !== Role.ADMIN) return { success: false, error: "Admin only" };

    if (githubRepo !== null) {
      const repo = githubRepo.trim();
      if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        return { success: false, error: "Repo must look like owner/name" };
      }
      githubRepo = repo || null;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { githubRepo },
    });
    revalidatePath("/github");
    revalidateProjectsCache();
    return { success: true, data: project };
  } catch (error: any) {
    console.error("Failed to update github repo:", error);
    return { success: false, error: "Failed to update repository" };
  }
}
