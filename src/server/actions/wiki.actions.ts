"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function createNotebook(projectId: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const notebook = await prisma.notebook.create({
      data: {
        title,
        projectId,
        content: `<h1>${title}</h1><p></p>`,
        createdById: session.user.id,
      },
    });

    return { success: true, notebook };
  } catch (error: any) {
    console.error("Error creating notebook:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteNotebook(notebookId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notebook.delete({
      where: { id: notebookId },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting notebook:", error);
    return { success: false, error: error.message };
  }
}

export async function updateNotebookContent(notebookId: string, content: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notebook.update({
      where: { id: notebookId },
      data: { content },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error updating notebook content:", error);
    return { success: false, error: error.message };
  }
}
