"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Label } from "@prisma/client";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const createLabelSchema = z.object({
  name: z.string().min(1, "Label name is required").max(30, "Max 30 characters"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex code like #5B5FEF"),
});

const HEX_COLORS = [
  "#5B5FEF",
  "#007ACC",
  "#1EAE7C",
  "#C79A3D",
  "#D9713C",
  "#D1495B",
  "#9B59B6",
  "#EC6A52",
  "#0E9BD8",
  "#6E7681",
];

/** Create a custom label (or return existing one with the same name). */
export async function createLabel(input: {
  name: string;
  color?: string;
}): Promise<Result<Label>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const parsed = createLabelSchema.safeParse({
      name: input.name.trim(),
      color: input.color ?? HEX_COLORS[input.name.trim().length % HEX_COLORS.length],
    });
    if (!parsed.success)
      return { success: false, error: parsed.error.errors[0].message };

    const { name, color } = parsed.data;

    // Idempotent: reuse existing label with same name (case-sensitive unique in schema)
    const existing = await prisma.label.findUnique({ where: { name } });
    if (existing) return { success: true, data: existing };

    try {
      const label = await prisma.label.create({ data: { name, color } });
      return { success: true, data: label };
    } catch (error: any) {
      // Concurrent create with the same name → return the winner instead of failing
      if (error?.code === "P2002") {
        const winner = await prisma.label.findUnique({ where: { name } });
        if (winner) return { success: true, data: winner };
      }
      throw error;
    }
  } catch (error) {
    console.error("createLabel error:", error);
    return { success: false, error: "Failed to create label" };
  }
}
