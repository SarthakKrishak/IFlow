import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveProject } from "@/lib/project";
import { getExtraAssigneesMap } from "@/lib/assignees";

// Deduplicate auth() calls within a single render tree (layout + page both call auth)
export const getCachedSession = cache(auth);

// Deduplicate getActiveProject() calls within a single render tree
export const getCachedActiveProject = cache(getActiveProject);

// Deduplicate user list fetches (layout sidebar + board page both need users)
export const getCachedUsers = cache(async () => {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, username: true, displayName: true, avatarColor: true, role: true, lastSeenAt: true, isActive: true, createdAt: true },
    orderBy: { displayName: "asc" },
  });
});

// Deduplicate label fetches (board page metadata + page function both may need labels)
export const getCachedLabels = cache(async () => {
  return prisma.label.findMany({ orderBy: { name: "asc" } });
});

// Deduplicate board fetch between generateMetadata and page() for /board/[boardId]
export const getCachedBoard = cache(async (boardId: string) => {
  const board = await prisma.board.findUnique({
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

  if (!board) return board;

  // Attach multi-assignees additively (fail-soft until migration is applied).
  const ticketIds = board.columns.flatMap((c) => c.tickets.map((t) => t.id));
  const extrasMap = await getExtraAssigneesMap(ticketIds);

  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      tickets: col.tickets.map((t) => ({
        ...t,
        extraAssignees: (extrasMap.get(t.id) ?? []).map((user) => ({ user })),
      })),
    })),
  };
});
