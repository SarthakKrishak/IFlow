"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function createNotebook(projectId: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const cleanTitle = title.trim().slice(0, 100);
    if (!cleanTitle) {
      return { success: false, error: "Notebook name is required" };
    }

    const notebook = await prisma.notebook.create({
      data: {
        title: cleanTitle,
        projectId,
        content: `<h1>${escapeHtml(cleanTitle)}</h1><p></p>`,
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

    if (typeof content !== "string" || content.length > 500000) {
      return { success: false, error: "Content is too large" };
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
