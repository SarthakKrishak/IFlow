"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createUserSchema,
  deactivateUserSchema,
  resetPasswordSchema,
  updateOwnPasswordSchema,
} from "@/lib/validators";
import type { User } from "@prisma/client";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

type Result<T> = { success: true; data: T } | { success: false; error: string };

type SafeUser = Omit<User, "passwordHash">;

const BCRYPT_COST = 12;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.role !== Role.ADMIN) throw new Error("Admin only");
  return session;
}

export async function createUser(input: {
  username: string;
  tempPassword: string;
  displayName: string;
  department: "DEV" | "DESIGN" | "MARKETING" | "GENERAL";
  role: "ADMIN" | "MANAGER" | "MEMBER";
}): Promise<Result<SafeUser>> {
  try {
    await requireAdmin();

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { username, tempPassword, displayName, department, role } = parsed.data;

    // Friendly username conflict check
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return { success: false, error: "That username's taken" };

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName,
        department,
        role,
        mustChangePassword: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...safeUser } = user;
    return { success: true, data: safeUser };
  } catch (error) {
    if (error instanceof Error && error.message === "Admin only") {
      return { success: false, error: "Admin only" };
    }
    console.error("createUser error:", error);
    return { success: false, error: "Failed to create user" };
  }
}

export async function deactivateUser(input: {
  userId: string;
}): Promise<Result<void>> {
  try {
    const session = await requireAdmin();

    const parsed = deactivateUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { userId } = parsed.data;

    // Prevent self-deactivation
    if (userId === session.user.id) {
      return { success: false, error: "You can't deactivate yourself" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "Admin only") {
      return { success: false, error: "Admin only" };
    }
    console.error("deactivateUser error:", error);
    return { success: false, error: "Failed to deactivate user" };
  }
}

export async function resetPassword(input: {
  userId: string;
  newTempPassword: string;
}): Promise<Result<void>> {
  try {
    await requireAdmin();

    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { userId, newTempPassword } = parsed.data;

    const passwordHash = await bcrypt.hash(newTempPassword, BCRYPT_COST);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && error.message === "Admin only") {
      return { success: false, error: "Admin only" };
    }
    console.error("resetPassword error:", error);
    return { success: false, error: "Failed to reset password" };
  }
}

export async function updateOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const parsed = updateOwnPasswordSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return { success: false, error: "User not found" };

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return { success: false, error: "Current password is incorrect" };

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("updateOwnPassword error:", error);
    return { success: false, error: "Failed to update password" };
  }
}
