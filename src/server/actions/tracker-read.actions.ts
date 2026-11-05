"use server";

import { z } from "zod";
import { done, fail, prisma, requireActor, toResult } from "@/lib/page-tracker/server";

const userSelect = { id: true, displayName: true, avatarColor: true } as const;

/** Everything the work-item drawer shows. Read-only; any active user may call it. */
export async function getWorkItemDetail(input: { workItemId: string }) {
  try {
    await requireActor();
    const id = z.string().cuid().safeParse(input?.workItemId);
    if (!id.success) return fail("Invalid request");

    const auditsPromise = prisma.trackerAudit.findMany({
      where: { workItemId: id.data },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { actor: { select: userSelect } },
    });
    const item = await prisma.workItem.findUnique({
      where: { id: id.data },
      include: {
        page: { select: { id: true, name: true, archivedAt: true, membersCanCreate: true } },
        assignee: { select: userSelect },
        reviewer: { select: userSelect },
        createdBy: { select: userSelect },
        ticket: {
          select: { id: true, boardId: true, board: { select: { name: true } }, column: { select: { name: true } } },
        },
        testCases: { orderBy: { order: "asc" } },
        submissions: {
          orderBy: { submissionNumber: "desc" },
          include: {
            submittedBy: { select: userSelect },
            review: { include: { reviewer: { select: userSelect } } },
          },
        },
        comments: { orderBy: { createdAt: "asc" }, take: 200, include: { author: { select: userSelect } } },
        testBugs: {
          include: { assignee: { select: userSelect }, reporter: { select: userSelect } },
          orderBy: { createdAt: "desc" },
        },
        devBugs: {
          include: { assignee: { select: userSelect }, reporter: { select: userSelect } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    const audits = await auditsPromise;
    if (!item) return fail("Work item not found");
    return done({ item, audits });
  } catch (e) {
    return toResult(e, "getWorkItemDetail");
  }
}

export type WorkItemDetail = Extract<Awaited<ReturnType<typeof getWorkItemDetail>>, { success: true }>["data"];
