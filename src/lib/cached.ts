import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Cross-request cache for quasi-static reference data.
 *
 * The app layout refetches users/labels/projects/boards on EVERY navigation
 * and every router.refresh(). These tables change rarely, so serving them
 * from memory (with tag-based invalidation on every mutation) turns most
 * navigations from ~200ms of DB round-trips into ~1ms cache hits.
 *
 * Rule: every server action that mutates one of these tables MUST call the
 * matching revalidate*() helper below, otherwise the UI shows stale data.
 */

export const TAG_USERS = "ref:users";
export const TAG_LABELS = "ref:labels";
export const TAG_PROJECTS = "ref:projects";
export const TAG_BOARDS = "ref:boards";

export const revalidateUsersCache = () => revalidateTag(TAG_USERS);
export const revalidateLabelsCache = () => revalidateTag(TAG_LABELS);
export const revalidateProjectsCache = () => revalidateTag(TAG_PROJECTS);
export const revalidateBoardsCache = () => revalidateTag(TAG_BOARDS);

export const getHeavyCachedUsers = unstable_cache(
  async () =>
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarColor: true,
        role: true,
        lastSeenAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { displayName: "asc" },
    }),
  ["ref-users"],
  { tags: [TAG_USERS], revalidate: 60 }
);

export const getHeavyCachedLabels = unstable_cache(
  async () => prisma.label.findMany({ orderBy: { name: "asc" } }),
  ["ref-labels"],
  { tags: [TAG_LABELS], revalidate: 120 }
);

export const getHeavyCachedProjects = unstable_cache(
  async () => prisma.project.findMany({ orderBy: { name: "asc" } }),
  ["ref-projects"],
  { tags: [TAG_PROJECTS], revalidate: 120 }
);

export const getHeavyCachedBoards = unstable_cache(
  async () =>
    prisma.board.findMany({
      select: { id: true, name: true, slug: true, projectId: true },
      orderBy: { createdAt: "asc" },
    }),
  ["ref-boards"],
  { tags: [TAG_BOARDS], revalidate: 60 }
);
