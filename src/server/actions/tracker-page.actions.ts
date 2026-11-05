"use server";

import { getActiveProject } from "@/lib/project";
import { ACTION } from "@/lib/page-tracker/constants";
import { canManagePage, derivePageLifecycle } from "@/lib/page-tracker/policy";
import {
  ActionError,
  assertActiveUser,
  denied,
  done,
  fail,
  prisma,
  requireActor,
  toResult,
  writeAudit,
  type Result,
} from "@/lib/page-tracker/server";
import { createPageSchema, updatePageSchema } from "@/lib/page-tracker/validators";
import { z } from "zod";

export async function createPage(input: z.input<typeof createPageSchema>): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireActor();
    const d = denied(canManagePage(actor));
    if (d) return d;
    const parsed = createPageSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const v = parsed.data;

    const project = await getActiveProject();
    if (!project) return fail("No active project");
    if (v.ownerId) await assertActiveUser(v.ownerId, "page owner");

    const page = await prisma.$transaction(async (tx) => {
      const p = await tx.trackerPage.create({
        data: {
          projectId: project.id,
          name: v.name,
          description: v.description || null,
          type: v.type,
          priority: v.priority,
          ownerId: v.ownerId ?? null,
          targetDate: v.targetDate ? new Date(v.targetDate) : null,
          links: v.links ?? [],
          designRequired: v.designRequired,
          developmentRequired: v.developmentRequired,
          testingRequired: v.testingRequired,
          requireFinalApproval: v.requireFinalApproval,
          membersCanCreate: v.membersCanCreate,
          createdById: actor.id,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.PAGE_CREATED,
        pageId: p.id,
        summary: p.name,
      });
      return p;
    });
    return done({ id: page.id });
  } catch (e) {
    return toResult(e, "createPage");
  }
}

export async function updatePage(input: z.input<typeof updatePageSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManagePage(actor));
    if (d) return d;
    const parsed = updatePageSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { pageId, changes } = parsed.data;

    const page = await prisma.trackerPage.findUnique({ where: { id: pageId } });
    if (!page) return fail("Page not found");
    if (page.archivedAt) return fail("This page is archived");
    if (changes.ownerId) await assertActiveUser(changes.ownerId, "page owner");

    const data = {
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.description !== undefined && { description: changes.description || null }),
      ...(changes.type !== undefined && { type: changes.type }),
      ...(changes.priority !== undefined && { priority: changes.priority }),
      ...(changes.ownerId !== undefined && { ownerId: changes.ownerId }),
      ...(changes.targetDate !== undefined && {
        targetDate: changes.targetDate ? new Date(changes.targetDate) : null,
      }),
      ...(changes.links !== undefined && { links: changes.links }),
      ...(changes.designRequired !== undefined && { designRequired: changes.designRequired }),
      ...(changes.developmentRequired !== undefined && { developmentRequired: changes.developmentRequired }),
      ...(changes.testingRequired !== undefined && { testingRequired: changes.testingRequired }),
      ...(changes.requireFinalApproval !== undefined && { requireFinalApproval: changes.requireFinalApproval }),
      ...(changes.membersCanCreate !== undefined && { membersCanCreate: changes.membersCanCreate }),
    };
    if (Object.keys(data).length === 0) return done(undefined);

    await prisma.$transaction(async (tx) => {
      await tx.trackerPage.update({ where: { id: pageId }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.PAGE_UPDATED,
        pageId,
        summary: Object.keys(data).join(", "),
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "updatePage");
  }
}

export async function setPageArchived(input: { pageId: string; archived: boolean }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManagePage(actor));
    if (d) return d;
    const parsed = z.object({ pageId: z.string().cuid(), archived: z.boolean() }).safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const { pageId, archived } = parsed.data;
    const page = await prisma.trackerPage.findUnique({ where: { id: pageId }, select: { id: true } });
    if (!page) return fail("Page not found");

    await prisma.$transaction(async (tx) => {
      await tx.trackerPage.update({
        where: { id: pageId },
        data: { archivedAt: archived ? new Date() : null },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: archived ? ACTION.PAGE_ARCHIVED : ACTION.PAGE_RESTORED,
        pageId,
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "setPageArchived");
  }
}

/** Final release sign-off. Only possible once the completion gate passes. */
export async function approveRelease(input: { pageId: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManagePage(actor));
    if (d) return d;
    const parsed = z.object({ pageId: z.string().cuid() }).safeParse(input);
    if (!parsed.success) return fail("Invalid request");

    const page = await prisma.trackerPage.findUnique({
      where: { id: parsed.data.pageId },
      include: {
        workItems: { select: { workstream: true, status: true, isRequired: true, archivedAt: true } },
        bugs: { select: { status: true, releaseBlocking: true } },
      },
    });
    if (!page) return fail("Page not found");
    if (page.archivedAt) return fail("This page is archived");
    if (!page.requireFinalApproval) return fail("This page does not require a final release approval");
    if (page.releasedAt) return fail("Release is already approved");

    const result = derivePageLifecycle(page, page.workItems, page.bugs);
    if (!result.gatePassed) {
      throw new ActionError(`Cannot approve release yet: ${result.gateProblems.join("; ")}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.trackerPage.update({
        where: { id: page.id },
        data: { releasedAt: new Date(), releasedById: actor.id },
      });
      await writeAudit(tx, { actorId: actor.id, action: ACTION.PAGE_RELEASED, pageId: page.id });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "approveRelease");
  }
}
