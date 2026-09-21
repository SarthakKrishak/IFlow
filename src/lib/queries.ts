import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActiveProject } from "@/lib/project";
import { getExtraAssigneesMap } from "@/lib/assignees";
import { getHeavyCachedUsers, getHeavyCachedLabels } from "@/lib/cached";

// Deduplicate auth() calls within a single render tree (layout + page both call auth)
export const getCachedSession = cache(auth);

// Deduplicate getActiveProject() calls within a single render tree
export const getCachedActiveProject = cache(getActiveProject);

// Deduplicate user list fetches (layout sidebar + board page both need users).
// Backed by a 60s cross-request cache (invalidated on every user mutation),
// so repeat navigations skip the DB round-trip entirely.
export const getCachedUsers = cache(getHeavyCachedUsers);

// Deduplicate label fetches (board page metadata + page function both may need labels).
// Backed by a 120s cross-request cache, invalidated on label create.
export const getCachedLabels = cache(getHeavyCachedLabels);

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
