"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createProject(data: { name: string; description?: string }) {
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
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
  return { success: true, data: project };
}
