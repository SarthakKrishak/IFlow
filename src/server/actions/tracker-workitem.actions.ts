"use server";

import { z } from "zod";
import { getActiveProject } from "@/lib/project";
import { extractMentionedUserIds } from "@/lib/mentions";
import { ACTION } from "@/lib/page-tracker/constants";
import {
  canAcknowledge,
  canCreateWorkItem,
  canManageAssignment,
  canOverride,
  canReassign,
  canSubmit,
  validateOwnerTransition,
  validateReviewerChoice,
  validateSubmission,
  validateTestingApproval,
} from "@/lib/page-tracker/policy";
import {
  ActionError,
  STALE_MESSAGE,
  assertActiveUser,
  assertAssignable,
  createMirrorTicket,
  denied,
  done,
  fail,
  itemLink,
  loadItemForOwnerEdit,
  notify,
  prisma,
  requireActor,
  syncMirrorTicket,
  toEvidence,
  toResult,
  writeAudit,
  type Result,
} from "@/lib/page-tracker/server";
import {
  changeReviewerSchema,
  commentSchema,
  createWorkItemSchema,
  overrideSchema,
  planningSchema,
  reassignSchema,
  statusChangeSchema,
  submitSchema,
  updateWorkItemSchema,
} from "@/lib/page-tracker/validators";

const idSchema = z.string().cuid();

// ── Create ──────────────────────────────────────────────────────────────────

export async function createWorkItem(
  input: z.input<typeof createWorkItemSchema>
): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireActor();
    const parsed = createWorkItemSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const v = parsed.data;

    const page = await prisma.trackerPage.findUnique({ where: { id: v.pageId } });
    if (!page) return fail("Page not found");
    const project = await getActiveProject();
    if (!project || project.id !== page.projectId) return fail("This page belongs to a different project");

    const d = denied(canCreateWorkItem(actor, page, v.assigneeId));
    if (d) return d;

    await assertAssignable(v.assigneeId);
    const rv = validateReviewerChoice(v.reviewerId ?? null, v.assigneeId, { requiresReview: v.requiresReview });
    if (!rv.ok) return fail(rv.error);
    if (v.reviewerId) await assertActiveUser(v.reviewerId, "reviewer");
    // Only leads choose the board mirror / reviewer for others.
    const dueDate = v.dueDate ? new Date(v.dueDate) : null;

    const created = await prisma.$transaction(async (tx) => {
      const max = await tx.workItem.aggregate({
        where: { pageId: v.pageId, workstream: v.workstream },
        _max: { order: true },
      });
      let ticketId: string | null = null;
      if (v.boardId) {
        ticketId = await createMirrorTicket(tx, {
          boardId: v.boardId,
          projectId: page.projectId,
          creatorId: actor.id,
          pageName: page.name,
          workstream: v.workstream,
          title: v.title,
          assigneeId: v.assigneeId,
          priority: v.priority,
          dueDate,
          pageId: page.id,
        });
      }
      const item = await tx.workItem.create({
        data: {
          pageId: v.pageId,
          workstream: v.workstream,
          title: v.title,
          description: v.description || null,
          acceptanceCriteria: v.acceptanceCriteria || null,
          priority: v.priority,
          assigneeId: v.assigneeId,
          reviewerId: v.reviewerId ?? null,
          requiresReview: v.requiresReview,
          dueDate,
          links: v.links ?? [],
          evidence: [],
          order: (max._max.order ?? -1) + 1,
          ticketId,
          createdById: actor.id,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.ITEM_CREATED,
        pageId: v.pageId,
        workItemId: item.id,
        summary: item.title,
        after: { workstream: v.workstream, assigneeId: v.assigneeId, reviewerId: v.reviewerId ?? null },
      });
      return item;
    });

    await notify({
      userIds: [v.assigneeId],
      actorId: actor.id,
      type: "WORK_ASSIGNED",
      title: `${actor.displayName} assigned you a work item`,
      body: `${page.name} › ${created.title}`,
      link: itemLink(page.id, created.id),
    });
    if (v.reviewerId) {
      await notify({
        userIds: [v.reviewerId],
        actorId: actor.id,
        type: "WORK_ASSIGNED",
        title: `${actor.displayName} made you the reviewer`,
        body: `${page.name} › ${created.title}`,
        link: itemLink(page.id, created.id),
      });
    }
    return done({ id: created.id });
  } catch (e) {
    return toResult(e, "createWorkItem");
  }
}

// ── Owner-controlled: details ───────────────────────────────────────────────

export async function updateWorkItem(
  input: z.input<typeof updateWorkItemSchema>
): Promise<Result<{ version: number }>> {
  try {
    const actor = await requireActor();
    const parsed = updateWorkItemSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, expectedVersion, changes } = parsed.data;

    const item = await loadItemForOwnerEdit(workItemId, actor);
    if (item.version !== expectedVersion) return fail(STALE_MESSAGE);

    const dueChanged = changes.dueDate !== undefined;
    const newDue = changes.dueDate ? new Date(changes.dueDate) : null;
    const data = {
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.description !== undefined && { description: changes.description || null }),
      ...(changes.acceptanceCriteria !== undefined && { acceptanceCriteria: changes.acceptanceCriteria || null }),
      ...(changes.notes !== undefined && { notes: changes.notes || null }),
      ...(dueChanged && { dueDate: newDue }),
      ...(changes.links !== undefined && { links: changes.links }),
      ...(changes.evidence !== undefined && { evidence: changes.evidence }),
    };
    if (Object.keys(data).length === 0) return done({ version: item.version });

    const version = await prisma.$transaction(async (tx) => {
      // Guarded write: must still be the same assignee, status and version.
      const res = await tx.workItem.updateMany({
        where: { id: workItemId, version: expectedVersion, assigneeId: actor.id, status: item.status },
        data: { ...data, version: { increment: 1 } },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);

      const keys = Object.keys(data);
      const otherKeys = keys.filter((k) => !["dueDate", "evidence"].includes(k));
      if (otherKeys.length > 0) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: ACTION.ITEM_UPDATED,
          pageId: item.pageId,
          workItemId,
          summary: otherKeys.join(", "),
        });
      }
      if (dueChanged) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: ACTION.DUE_DATE_CHANGED,
          pageId: item.pageId,
          workItemId,
          before: { dueDate: item.dueDate?.toISOString() ?? null },
          after: { dueDate: newDue?.toISOString() ?? null },
        });
      }
      if (changes.evidence !== undefined) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: ACTION.EVIDENCE_CHANGED,
          pageId: item.pageId,
          workItemId,
          summary: `${changes.evidence.length} evidence link(s)`,
        });
      }
      await syncMirrorTicket(tx, item.ticketId, actor.id, {
        ...(changes.title !== undefined && { title: changes.title }),
        ...(dueChanged && { dueDate: newDue }),
      });
      return expectedVersion + 1;
    });
    return done({ version });
  } catch (e) {
    return toResult(e, "updateWorkItem");
  }
}

// ── Owner-controlled: status ────────────────────────────────────────────────

export async function changeWorkItemStatus(
  input: z.input<typeof statusChangeSchema>
): Promise<Result<{ version: number }>> {
  try {
    const actor = await requireActor();
    const parsed = statusChangeSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, expectedVersion, to, reason } = parsed.data;

    const item = await loadItemForOwnerEdit(workItemId, actor);
    if (item.version !== expectedVersion) return fail(STALE_MESSAGE);
    const t = validateOwnerTransition(item.status, to, reason);
    if (!t.ok) return fail(t.error);

    await prisma.$transaction(async (tx) => {
      const res = await tx.workItem.updateMany({
        where: { id: workItemId, version: expectedVersion, assigneeId: actor.id, status: item.status },
        data: {
          status: to,
          blockedReason: to === "BLOCKED" ? reason!.trim() : null,
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.STATUS_CHANGED,
        pageId: item.pageId,
        workItemId,
        before: { status: item.status },
        after: { status: to },
        reason: to === "BLOCKED" ? reason!.trim() : null,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { status: to });
    });

    if (to === "BLOCKED") {
      await notify({
        userIds: [item.page.ownerId, item.createdById],
        actorId: actor.id,
        type: "WORK_BLOCKED",
        title: `${actor.displayName} blocked a work item`,
        body: `${item.page.name} › ${item.title}: ${reason!.trim()}`,
        link: itemLink(item.pageId, workItemId),
      });
    }
    return done({ version: expectedVersion + 1 });
  } catch (e) {
    return toResult(e, "changeWorkItemStatus");
  }
}

export async function acknowledgeOwnership(input: { workItemId: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const id = idSchema.safeParse(input?.workItemId);
    if (!id.success) return fail("Invalid request");
    const item = await prisma.workItem.findUnique({ where: { id: id.data } });
    if (!item) return fail("Work item not found");
    const d = denied(canAcknowledge(actor, item));
    if (d) return d;

    await prisma.$transaction(async (tx) => {
      const res = await tx.workItem.updateMany({
        where: { id: item.id, assigneeId: actor.id, ownerAcknowledged: false },
        data: { ownerAcknowledged: true, version: { increment: 1 } },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.OWNERSHIP_ACKNOWLEDGED,
        pageId: item.pageId,
        workItemId: item.id,
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "acknowledgeOwnership");
  }
}

// ── Owner-controlled: submit for review ─────────────────────────────────────

export async function submitWorkItem(
  input: z.input<typeof submitSchema>
): Promise<Result<{ submissionNumber: number; status: "READY_FOR_REVIEW" | "DONE" }>> {
  try {
    const actor = await requireActor();
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, expectedVersion, summary } = parsed.data;

    const base = await loadItemForOwnerEdit(workItemId, actor);
    if (base.version !== expectedVersion) return fail(STALE_MESSAGE);
    const s = canSubmit(base);
    if (!s.ok) return fail(s.error);

    const [item, testCases] = await Promise.all([
      prisma.workItem.findUniqueOrThrow({ where: { id: workItemId } }),
      prisma.testCase.findMany({ where: { workItemId }, orderBy: { order: "asc" } }),
    ]);
    const evidence = toEvidence(item.evidence);

    const problems = validateSubmission({
      workstream: item.workstream,
      summary,
      evidence,
      testCases,
    });
    if (problems.length > 0) return fail(problems.join("\n"));

    const rv = validateReviewerChoice(item.reviewerId, item.assigneeId, { requiresReview: item.requiresReview });
    if (!rv.ok) return fail(rv.error);

    const snapshot =
      item.workstream === "TESTING"
        ? testCases.map((t) => ({
            id: t.id,
            title: t.title,
            isMandatory: t.isMandatory,
            result: t.result,
            preconditions: t.preconditions,
            steps: t.steps,
            expected: t.expected,
            actual: t.actual,
            environment: t.environment,
            buildVersion: t.buildVersion,
            evidenceUrl: t.evidenceUrl,
            testedAt: t.testedAt?.toISOString() ?? null,
          }))
        : null;

    // Without a review step a testing item still can't close over failing mandatory tests.
    if (!item.requiresReview && item.workstream === "TESTING") {
      const g = validateTestingApproval(actor, snapshot);
      if (!g.ok) return fail(g.error);
    }

    const finalStatus = item.requiresReview ? "READY_FOR_REVIEW" : "DONE";
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.workItemSubmission.count({ where: { workItemId } });
      const number = count + 1;
      const submission = await tx.workItemSubmission.create({
        data: {
          workItemId,
          submissionNumber: number,
          submittedById: actor.id,
          summary,
          evidence: JSON.parse(JSON.stringify(evidence)),
          testResults: snapshot ?? undefined,
          status: item.requiresReview ? "PENDING" : "APPROVED",
        },
      });
      const res = await tx.workItem.updateMany({
        where: { id: workItemId, version: expectedVersion, assigneeId: actor.id, status: item.status },
        data: {
          status: finalStatus,
          currentSubmissionId: submission.id,
          blockedReason: null,
          completedAt: finalStatus === "DONE" ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.SUBMITTED,
        pageId: item.pageId,
        workItemId,
        summary: `Submission #${number}`,
        before: { status: item.status },
        after: { status: finalStatus },
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { status: finalStatus });
      return number;
    });

    if (item.requiresReview) {
      const page = await prisma.trackerPage.findUnique({ where: { id: item.pageId }, select: { name: true } });
      await notify({
        userIds: [item.reviewerId],
        actorId: actor.id,
        type: "REVIEW_REQUESTED",
        title: `${actor.displayName} submitted work for your review`,
        body: `${page?.name ?? ""} › ${item.title} (v${result})`,
        link: itemLink(item.pageId, workItemId),
      });
    }
    return done({ submissionNumber: result, status: finalStatus });
  } catch (e) {
    return toResult(e, "submitWorkItem");
  }
}

// ── Lead-controlled: assignment ─────────────────────────────────────────────

export async function reassignWorkItem(input: z.input<typeof reassignSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = reassignSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, newAssigneeId, reason } = parsed.data;

    const item = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { page: { select: { name: true, archivedAt: true } }, assignee: { select: { displayName: true } } },
    });
    if (!item) return fail("Work item not found");
    const d = denied(canReassign(actor, item));
    if (d) return d;
    if (item.page.archivedAt) return fail("This page is archived");
    if (item.assigneeId === newAssigneeId) return fail("That person is already the assignee");
    if (item.reviewerId === newAssigneeId) {
      return fail("That person is the reviewer — change the reviewer first");
    }
    const newOwner = await assertAssignable(newAssigneeId, "new assignee");
    const ack = item.status === "NOT_STARTED";

    await prisma.$transaction(async (tx) => {
      // Guarded: the ownership we authorized against must still hold.
      const res = await tx.workItem.updateMany({
        where: { id: workItemId, assigneeId: item.assigneeId, version: item.version },
        data: { assigneeId: newAssigneeId, ownerAcknowledged: ack, version: { increment: 1 } },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.ASSIGNEE_CHANGED,
        pageId: item.pageId,
        workItemId,
        before: { assigneeId: item.assigneeId },
        after: { assigneeId: newOwner.id },
        reason,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { assigneeId: newAssigneeId });
    });

    await notify({
      userIds: [newAssigneeId],
      actorId: actor.id,
      type: "WORK_REASSIGNED",
      title: `${actor.displayName} reassigned a work item to you`,
      body: `${item.page.name} › ${item.title}${ack ? "" : " — acknowledge ownership to continue"}`,
      link: itemLink(item.pageId, workItemId),
    });
    await notify({
      userIds: [item.assigneeId],
      actorId: actor.id,
      type: "WORK_REASSIGNED",
      title: `${actor.displayName} reassigned your work item`,
      body: `${item.page.name} › ${item.title}: ${reason}`,
      link: itemLink(item.pageId, workItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "reassignWorkItem");
  }
}

export async function changeReviewer(input: z.input<typeof changeReviewerSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = changeReviewerSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, reviewerId, reason } = parsed.data;

    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const item = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { page: { select: { name: true, archivedAt: true } } },
    });
    if (!item) return fail("Work item not found");
    if (item.page.archivedAt || item.archivedAt) return fail("This work item is archived");
    if (item.status === "DONE" || item.status === "CANCELLED") return fail("Closed work items cannot change reviewer");

    const current = item.currentSubmissionId
      ? await prisma.workItemSubmission.findUnique({
          where: { id: item.currentSubmissionId },
          select: { submittedById: true },
        })
      : null;
    const rv = validateReviewerChoice(reviewerId, item.assigneeId, {
      requiresReview: item.requiresReview,
      submitterId: current?.submittedById,
    });
    if (!rv.ok) return fail(rv.error);
    await assertActiveUser(reviewerId, "reviewer");

    await prisma.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: workItemId },
        data: { reviewerId, version: { increment: 1 } },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.REVIEWER_CHANGED,
        pageId: item.pageId,
        workItemId,
        before: { reviewerId: item.reviewerId },
        after: { reviewerId },
        reason,
      });
    });
    await notify({
      userIds: [reviewerId],
      actorId: actor.id,
      type: "REVIEW_REQUESTED",
      title:
        item.status === "READY_FOR_REVIEW"
          ? `${actor.displayName} assigned you a submission to review`
          : `${actor.displayName} made you the reviewer`,
      body: `${item.page.name} › ${item.title}`,
      link: itemLink(item.pageId, workItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "changeReviewer");
  }
}

/** Lead-controlled planning fields: priority, due date, completion-gate membership. */
export async function managePlanning(input: z.input<typeof planningSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const parsed = planningSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, changes } = parsed.data;

    const item = await prisma.workItem.findUnique({ where: { id: workItemId } });
    if (!item) return fail("Work item not found");
    if (item.archivedAt) return fail("This work item is archived");
    if (item.status === "DONE" || item.status === "CANCELLED") return fail("Closed work items cannot be changed");
    if (changes.isRequired === false && !(changes.exclusionReason && changes.exclusionReason.trim().length >= 3)) {
      return fail("A reason is required to exclude an item from the completion gate");
    }
    const dueChanged = changes.dueDate !== undefined;
    const newDue = changes.dueDate ? new Date(changes.dueDate) : null;
    const data = {
      ...(changes.priority !== undefined && { priority: changes.priority }),
      ...(dueChanged && { dueDate: newDue }),
      ...(changes.isRequired !== undefined && {
        isRequired: changes.isRequired,
        exclusionReason: changes.isRequired ? null : changes.exclusionReason!.trim(),
      }),
    };
    if (Object.keys(data).length === 0) return done(undefined);

    await prisma.$transaction(async (tx) => {
      await tx.workItem.update({ where: { id: workItemId }, data: { ...data, version: { increment: 1 } } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.PLANNING_CHANGED,
        pageId: item.pageId,
        workItemId,
        before: { priority: item.priority, dueDate: item.dueDate?.toISOString() ?? null, isRequired: item.isRequired },
        after: {
          priority: changes.priority ?? item.priority,
          dueDate: dueChanged ? newDue?.toISOString() ?? null : item.dueDate?.toISOString() ?? null,
          isRequired: changes.isRequired ?? item.isRequired,
        },
        reason: changes.isRequired === false ? changes.exclusionReason!.trim() : null,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, {
        ...(changes.priority !== undefined && { priority: changes.priority }),
        ...(dueChanged && { dueDate: newDue }),
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "managePlanning");
  }
}

export async function cancelWorkItem(input: { workItemId: string; reason: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const parsed = z
      .object({ workItemId: idSchema, reason: z.string().trim().min(3, "A reason is required").max(500) })
      .safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const item = await prisma.workItem.findUnique({ where: { id: parsed.data.workItemId } });
    if (!item) return fail("Work item not found");
    if (item.status === "DONE" || item.status === "CANCELLED") return fail("This work item is already closed");

    await prisma.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: item.id },
        data: { status: "CANCELLED", cancelledReason: parsed.data.reason, version: { increment: 1 } },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.ITEM_CANCELLED,
        pageId: item.pageId,
        workItemId: item.id,
        before: { status: item.status },
        after: { status: "CANCELLED" },
        reason: parsed.data.reason,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { status: "CANCELLED" });
    });
    await notify({
      userIds: [item.assigneeId, item.reviewerId],
      actorId: actor.id,
      type: "WORK_REASSIGNED",
      title: `${actor.displayName} cancelled a work item`,
      body: `${item.title}: ${parsed.data.reason}`,
      link: itemLink(item.pageId, item.id),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "cancelWorkItem");
  }
}

export async function setWorkItemArchived(input: { workItemId: string; archived: boolean }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const parsed = z.object({ workItemId: idSchema, archived: z.boolean() }).safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const item = await prisma.workItem.findUnique({ where: { id: parsed.data.workItemId } });
    if (!item) return fail("Work item not found");
    await prisma.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: item.id },
        data: { archivedAt: parsed.data.archived ? new Date() : null, version: { increment: 1 } },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: parsed.data.archived ? ACTION.ITEM_ARCHIVED : ACTION.ITEM_RESTORED,
        pageId: item.pageId,
        workItemId: item.id,
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "setWorkItemArchived");
  }
}

export async function reorderWorkItem(input: { workItemId: string; direction: "up" | "down" }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const parsed = z.object({ workItemId: idSchema, direction: z.enum(["up", "down"]) }).safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const item = await prisma.workItem.findUnique({ where: { id: parsed.data.workItemId } });
    if (!item) return fail("Work item not found");
    const siblings = await prisma.workItem.findMany({
      where: { pageId: item.pageId, workstream: item.workstream, archivedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = siblings.map((s) => s.id);
    const idx = ids.indexOf(item.id);
    const j = idx + (parsed.data.direction === "up" ? -1 : 1);
    if (idx < 0 || j < 0 || j >= ids.length) return done(undefined);
    // Re-number the whole lane so ties from older data can't break ordering.
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await prisma.$transaction(ids.map((id, order) => prisma.workItem.update({ where: { id }, data: { order } })));
    return done(undefined);
  } catch (e) {
    return toResult(e, "reorderWorkItem");
  }
}

// ── Admin override (deliberate, reasoned, audited) ──────────────────────────

export async function adminOverrideUpdate(input: z.input<typeof overrideSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canOverride(actor));
    if (d) return d;
    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, reason, changes } = parsed.data;

    const item = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { page: { select: { name: true } } },
    });
    if (!item) return fail("Work item not found");
    if (item.status === "DONE" || item.status === "CANCELLED") return fail("Closed work items cannot be overridden");
    if (changes.status && item.status === "READY_FOR_REVIEW") {
      return fail("Status cannot be overridden while the item is under review");
    }
    if (changes.status === "BLOCKED" && !(changes.blockedReason && changes.blockedReason.trim().length >= 3)) {
      return fail("A blocked reason is required");
    }
    const dueChanged = changes.dueDate !== undefined;
    const newDue = changes.dueDate ? new Date(changes.dueDate) : null;
    const data = {
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.description !== undefined && { description: changes.description || null }),
      ...(changes.acceptanceCriteria !== undefined && { acceptanceCriteria: changes.acceptanceCriteria || null }),
      ...(changes.notes !== undefined && { notes: changes.notes || null }),
      ...(dueChanged && { dueDate: newDue }),
      ...(changes.priority !== undefined && { priority: changes.priority }),
      ...(changes.status !== undefined && {
        status: changes.status,
        blockedReason: changes.status === "BLOCKED" ? changes.blockedReason!.trim() : null,
      }),
    };
    if (Object.keys(data).length === 0) return fail("Nothing to change");

    await prisma.$transaction(async (tx) => {
      await tx.workItem.update({ where: { id: workItemId }, data: { ...data, version: { increment: 1 } } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.ADMIN_OVERRIDE,
        pageId: item.pageId,
        workItemId,
        isOverride: true,
        summary: Object.keys(data).join(", "),
        before: {
          title: item.title,
          status: item.status,
          priority: item.priority,
          dueDate: item.dueDate?.toISOString() ?? null,
        },
        after: JSON.parse(JSON.stringify(data)),
        reason,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, {
        ...(changes.title !== undefined && { title: changes.title }),
        ...(dueChanged && { dueDate: newDue }),
        ...(changes.priority !== undefined && { priority: changes.priority }),
        ...(changes.status !== undefined && { status: changes.status }),
      });
    });
    await notify({
      userIds: [item.assigneeId],
      actorId: actor.id,
      type: "TRACKER_COMMENT",
      title: `${actor.displayName} (admin) edited your work item`,
      body: `${item.page.name} › ${item.title}: ${reason}`,
      link: itemLink(item.pageId, workItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "adminOverrideUpdate");
  }
}

// ── Comments (append-only) ──────────────────────────────────────────────────

export async function addWorkItemComment(input: z.input<typeof commentSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, body } = parsed.data;
    const item = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: { page: { select: { name: true } } },
    });
    if (!item) return fail("Work item not found");

    await prisma.$transaction(async (tx) => {
      await tx.workItemComment.create({ data: { workItemId, authorId: actor.id, body } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.COMMENTED,
        pageId: item.pageId,
        workItemId,
        summary: body.length > 100 ? `${body.slice(0, 100)}…` : body,
      });
    });

    const members = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, displayName: true },
    });
    const mentioned = extractMentionedUserIds(body, members, actor.id);
    await notify({
      userIds: [item.assigneeId, item.reviewerId, ...mentioned],
      actorId: actor.id,
      type: mentioned.length ? "MENTION" : "TRACKER_COMMENT",
      title: `${actor.displayName} commented on a work item`,
      body: `${item.page.name} › ${item.title}: ${body.slice(0, 140)}`,
      link: itemLink(item.pageId, workItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "addWorkItemComment");
  }
}
