/**
 * Page Tracker — read models for the server-rendered pages.
 * Everything is scoped to the active project; all active users may read.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { derivePageLifecycle, isBugResolved } from "./policy";
import type { WorkItemStatus } from "./constants";
import { REVIEW_SLA_DAYS } from "./review-sla";

const userSelect = { id: true, displayName: true, avatarColor: true } as const;
export type UserLite = { id: string; displayName: string; avatarColor: string };

const OPEN_STATUSES: WorkItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
];


export async function getTrackerOverview(projectId: string) {
  const [pages, audits, recent] = await Promise.all([
    prisma.trackerPage.findMany({
      where: { projectId, archivedAt: null },
      orderBy: [{ createdAt: "asc" }],
      include: {
        owner: { select: userSelect },
        workItems: {
          where: { archivedAt: null },
          select: {
            id: true,
            workstream: true,
            status: true,
            isRequired: true,
            archivedAt: true,
            dueDate: true,
            priority: true,
          },
        },
        bugs: { select: { status: true, releaseBlocking: true, severity: true } },
      },
    }),
    prisma.trackerAudit.groupBy({
      by: ["pageId"],
      where: { page: { projectId } },
      _max: { createdAt: true },
    }),
    prisma.trackerAudit.findMany({
      where: { page: { projectId } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: userSelect }, page: { select: { id: true, name: true } } },
    }),
  ]);
  const lastMap = new Map(audits.map((a) => [a.pageId, a._max.createdAt]));
  const now = new Date();

  const rows = pages.map((p) => {
    const life = derivePageLifecycle(p, p.workItems, p.bugs);
    const open = p.workItems.filter((i) => OPEN_STATUSES.includes(i.status as WorkItemStatus));
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      priority: p.priority,
      targetDate: p.targetDate,
      owner: p.owner,
      requireFinalApproval: p.requireFinalApproval,
      releasedAt: p.releasedAt,
      lifecycle: life.lifecycle,
      gatePassed: life.gatePassed,
      streams: life.streams,
      openItems: open.length,
      pendingReviews: p.workItems.filter((i) => i.status === "READY_FOR_REVIEW").length,
      overdue: open.filter((i) => i.dueDate && i.dueDate < now).length,
      openBugs: p.bugs.filter((b) => !isBugResolved(b.status)).length,
      lastActivity: lastMap.get(p.id) ?? p.createdAt,
    };
  });

  const items = pages.flatMap((p) => p.workItems);
  const byStatus: Record<string, number> = {};
  for (const i of items) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  const bugsBySeverity: Record<string, number> = {};
  for (const p of pages)
    for (const b of p.bugs) if (!isBugResolved(b.status)) bugsBySeverity[b.severity] = (bugsBySeverity[b.severity] ?? 0) + 1;

  const workstream = (ws: "DESIGN" | "DEVELOPMENT" | "TESTING") => {
    const list = items.filter((i) => i.workstream === ws && i.status !== "CANCELLED");
    return { total: list.length, done: list.filter((i) => i.status === "DONE").length };
  };

  return {
    pages: rows,
    summary: {
      total: rows.length,
      inProgress: rows.filter((r) => !["NOT_STARTED", "COMPLETED", "BLOCKED"].includes(r.lifecycle)).length,
      completed: rows.filter((r) => r.lifecycle === "COMPLETED").length,
      blocked: rows.filter((r) => r.lifecycle === "BLOCKED").length,
      pendingReviews: items.filter((i) => i.status === "READY_FOR_REVIEW").length,
      overdue: items.filter((i) => OPEN_STATUSES.includes(i.status as WorkItemStatus) && i.dueDate && i.dueDate < now)
        .length,
    },
    byStatus,
    bugsBySeverity,
    workstreams: {
      DESIGN: workstream("DESIGN"),
      DEVELOPMENT: workstream("DEVELOPMENT"),
      TESTING: workstream("TESTING"),
    },
    recent,
  };
}

export async function getPageDetail(pageId: string, projectId: string) {
  const activityPromise = prisma.trackerAudit.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { actor: { select: userSelect }, workItem: { select: { id: true, title: true } } },
  });
  const page = await prisma.trackerPage.findFirst({
    where: { id: pageId, projectId },
    include: {
      owner: { select: userSelect },
      workItems: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: { select: userSelect },
          reviewer: { select: userSelect },
          ticket: {
            select: {
              id: true,
              boardId: true,
              board: { select: { name: true } },
              column: { select: { name: true } },
            },
          },
          _count: { select: { comments: true, testCases: true, submissions: true } },
        },
      },
      bugs: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: { select: userSelect },
          reporter: { select: userSelect },
          testCase: { select: { id: true, title: true } },
          testWorkItem: { select: { id: true, title: true, assigneeId: true } },
          devWorkItem: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!page) {
    activityPromise.catch(() => {});
    return null;
  }

  const activity = await activityPromise;

  const activeItems = page.workItems.filter((i) => !i.archivedAt);
  const life = derivePageLifecycle(page, activeItems, page.bugs);
  return { page, activity, life };
}

export async function getMyWork(userId: string, projectId: string) {
  const scope = { page: { projectId, archivedAt: null }, archivedAt: null } as const;
  const [assigned, reviewing, bugs, recentDone, retests] = await Promise.all([
    prisma.workItem.findMany({
      where: { ...scope, assigneeId: userId, status: { in: OPEN_STATUSES } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        page: { select: { id: true, name: true } },
        reviewer: { select: userSelect },
        _count: { select: { testCases: true } },
      },
    }),
    prisma.workItem.findMany({
      where: { ...scope, reviewerId: userId, status: { in: ["READY_FOR_REVIEW", "CHANGES_REQUESTED"] } },
      orderBy: { updatedAt: "asc" },
      include: { page: { select: { id: true, name: true } }, assignee: { select: userSelect } },
    }),
    prisma.trackerBug.findMany({
      where: {
        assigneeId: userId,
        page: { projectId, archivedAt: null },
        status: { notIn: ["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"] },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
      include: { page: { select: { id: true, name: true } } },
    }),
    prisma.workItem.count({ where: { ...scope, assigneeId: userId, status: "DONE" } }),
    // Bugs I filed that are waiting for ME to retest.
    prisma.trackerBug.findMany({
      where: {
        status: "READY_FOR_RETEST",
        page: { projectId, archivedAt: null },
        OR: [{ reporterId: userId }, { testWorkItem: { assigneeId: userId } }],
      },
      include: { page: { select: { id: true, name: true } } },
    }),
  ]);
  return { assigned, reviewing, bugs, retests, doneCount: recentDone };
}

export async function getReviewQueue(userId: string, projectId: string) {
  const scope = { page: { projectId, archivedAt: null }, archivedAt: null } as const;
  const [awaiting, changes, history] = await Promise.all([
    prisma.workItem.findMany({
      where: { ...scope, reviewerId: userId, status: "READY_FOR_REVIEW" },
      orderBy: { updatedAt: "asc" },
      include: {
        page: { select: { id: true, name: true } },
        assignee: { select: userSelect },
        submissions: { orderBy: { submissionNumber: "desc" }, take: 1 },
      },
    }),
    prisma.workItem.findMany({
      where: { ...scope, reviewerId: userId, status: "CHANGES_REQUESTED" },
      orderBy: { updatedAt: "desc" },
      include: { page: { select: { id: true, name: true } }, assignee: { select: userSelect } },
    }),
    prisma.workItemReview.findMany({
      where: { reviewerId: userId, workItem: { page: { projectId } } },
      orderBy: { reviewedAt: "desc" },
      take: 30,
      include: {
        workItem: { select: { id: true, title: true, pageId: true, page: { select: { name: true } } } },
        submission: { select: { submissionNumber: true } },
      },
    }),
  ]);
  const cutoff = Date.now() - REVIEW_SLA_DAYS * 86_400_000;
  return {
    awaiting: awaiting.map((i) => ({
      ...i,
      overdue: (i.submissions[0]?.submittedAt ?? i.updatedAt).getTime() < cutoff,
    })),
    changes,
    history,
  };
}

export async function getWorkload(projectId: string) {
  const [users, items] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { not: "ADMIN" } },
      select: { id: true, displayName: true, avatarColor: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.workItem.findMany({
      where: { page: { projectId, archivedAt: null }, archivedAt: null, status: { in: OPEN_STATUSES } },
      select: { assigneeId: true, status: true, dueDate: true },
    }),
  ]);
  const now = new Date();
  return users.map((u) => {
    const mine = items.filter((i) => i.assigneeId === u.id);
    return {
      user: u,
      open: mine.length,
      inProgress: mine.filter((i) => i.status === "IN_PROGRESS").length,
      blocked: mine.filter((i) => i.status === "BLOCKED").length,
      inReview: mine.filter((i) => i.status === "READY_FOR_REVIEW").length,
      changes: mine.filter((i) => i.status === "CHANGES_REQUESTED").length,
      overdue: mine.filter((i) => i.dueDate && i.dueDate < now).length,
    };
  });
}

export const getPendingReviewCount = cache(async (userId: string) => {
  try {
    return await prisma.workItem.count({
      where: { reviewerId: userId, status: "READY_FOR_REVIEW", archivedAt: null },
    });
  } catch {
    return 0; // table not migrated yet — never break the layout
  }
});
