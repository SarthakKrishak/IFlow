"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function deleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.project.delete({
      where: { id: projectId }
    });
    return { success: true };
  } catch (error: any) {
    console.error("deleteProject error:", error);
    return { success: false, error: "Failed to delete project" };
  }
}
