import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getCachedUsers = cache(async () => {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, avatarColor: true, role: true, lastSeenAt: true, isActive: true },
    orderBy: { displayName: "asc" },
  });
});
