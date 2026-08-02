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

export async function createPage(notebookId: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const page = await prisma.page.create({
      data: {
        title,
        notebookId,
        content: `<h1>${title}</h1><p></p>`,
      },
    });

    return { success: true, page };
  } catch (error: any) {
    console.error("Error creating page:", error);
    return { success: false, error: error.message };
  }
}

export async function updatePageContent(pageId: string, content: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.page.update({
      where: { id: pageId },
      data: { content },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error updating page content:", error);
    return { success: false, error: error.message };
  }
}

export async function deletePage(pageId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.page.delete({
      where: { id: pageId },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting page:", error);
    return { success: false, error: error.message };
  }
}
