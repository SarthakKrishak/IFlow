import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveProject } from "@/lib/project";

// Deduplicate auth() calls within a single render tree (layout + page both call auth)
export const getCachedSession = cache(auth);

// Deduplicate getActiveProject() calls within a single render tree
export const getCachedActiveProject = cache(getActiveProject);

// Deduplicate user list fetches (layout sidebar + board page both need users)
export const getCachedUsers = cache(async () => {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, displayName: true, avatarColor: true, role: true, lastSeenAt: true, isActive: true, createdAt: true },
    orderBy: { displayName: "asc" },
  });
});

// Deduplicate label fetches (board page metadata + page function both may need labels)
export const getCachedLabels = cache(async () => {
  return prisma.label.findMany({ orderBy: { name: "asc" } });
});

// Deduplicate board fetch between generateMetadata and page() for /board/[boardId]
export const getCachedBoard = cache(async (boardId: string) => {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          tickets: {
            orderBy: { order: "asc" },
            include: {
              assignee: { select: { id: true, displayName: true, avatarColor: true } },
              labels: { select: { id: true, name: true, color: true } },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });
});
