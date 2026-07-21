"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function pingPresence() {
  const session = await auth();
  if (!session?.user?.id) return;

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    // Ignore errors for simple presence pings
  }
}

export async function setOffline() {
  const session = await auth();
  if (!session?.user?.id) return;
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: null },
    });
  } catch (error) {}
}
