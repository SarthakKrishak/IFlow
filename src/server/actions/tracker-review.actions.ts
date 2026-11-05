"use server";

import { z } from "zod";
import { ACTION } from "@/lib/page-tracker/constants";
import {
  canReview,
  validateChangeRequest,
  validateTestingApproval,
  type TestCaseLike,
} from "@/lib/page-tracker/policy";
import {
  ActionError,
  STALE_MESSAGE,
  done,
  fail,
  itemLink,
  notify,
  prisma,
  requireActor,
  syncMirrorTicket,
  toResult,
  writeAudit,
  type Result,
} from "@/lib/page-tracker/server";
import { approveSchema, requestChangesSchema } from "@/lib/page-tracker/validators";

async function loadSubmission(submissionId: string) {
  const submission = await prisma.workItemSubmission.findUnique({
    where: { id: submissionId },
    include: { workItem: { include: { page: { select: { name: true, archivedAt: true } } } } },
  });
  if (!submission) throw new ActionError("Submission not found");
  return submission;
}

/**
 * Reviewer approves the CURRENT pending submission. The decision is bound to
 * that submission, guarded atomically against a concurrent re-submission, and
 * closes the work item as Done.
 */
export async function approveSubmission(input: z.input<typeof approveSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { submissionId, comment, exceptionReason } = parsed.data;

    const submission = await loadSubmission(submissionId);
    const item = submission.workItem;
    const d = canReview(actor, item, submission);
    if (!d.ok) return fail(d.error);
    if (item.page.archivedAt) return fail("This page is archived");

    if (item.workstream === "TESTING") {
      const snapshot = (Array.isArray(submission.testResults) ? submission.testResults : []) as unknown as TestCaseLike[];
      const gate = validateTestingApproval(actor, snapshot, exceptionReason);
      if (!gate.ok) return fail(gate.error);
    }
    const usedException =
      item.workstream === "TESTING" &&
      !!exceptionReason &&
      (submission.testResults as unknown as TestCaseLike[] | null)?.some((t) => t.isMandatory && t.result !== "PASS");

    await prisma.$transaction(async (tx) => {
      // Atomic claim of the submission: only one decision can ever win.
      const claim = await tx.workItemSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      if (claim.count !== 1) throw new ActionError("This submission has already been reviewed");
      const res = await tx.workItem.updateMany({
        where: {
          id: item.id,
          currentSubmissionId: submissionId,
          status: "READY_FOR_REVIEW",
          reviewerId: actor.id,
        },
        data: { status: "DONE", completedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await tx.workItemReview.create({
        data: {
          workItemId: item.id,
          submissionId,
          reviewerId: actor.id,
          decision: "APPROVED",
          comment: comment || null,
          exceptionReason: usedException ? exceptionReason!.trim() : null,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.APPROVED,
        pageId: item.pageId,
        workItemId: item.id,
        summary: `Submission #${submission.submissionNumber}${usedException ? " (with test exception)" : ""}`,
        before: { status: "READY_FOR_REVIEW" },
        after: { status: "DONE" },
        reason: usedException ? exceptionReason!.trim() : comment || null,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { status: "DONE" });
    });

    await notify({
      userIds: [item.assigneeId],
      actorId: actor.id,
      type: "REVIEW_APPROVED",
      title: `${actor.displayName} approved your submission`,
      body: `${item.page.name} › ${item.title}`,
      link: itemLink(item.pageId, item.id),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "approveSubmission");
  }
}

export async function requestChanges(input: z.input<typeof requestChangesSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = requestChangesSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { submissionId, comment } = parsed.data;
    const c = validateChangeRequest(comment);
    if (!c.ok) return fail(c.error);

    const submission = await loadSubmission(submissionId);
    const item = submission.workItem;
    const d = canReview(actor, item, submission);
    if (!d.ok) return fail(d.error);
    if (item.page.archivedAt) return fail("This page is archived");

    await prisma.$transaction(async (tx) => {
      const claim = await tx.workItemSubmission.updateMany({
        where: { id: submissionId, status: "PENDING" },
        data: { status: "CHANGES_REQUESTED" },
      });
      if (claim.count !== 1) throw new ActionError("This submission has already been reviewed");
      const res = await tx.workItem.updateMany({
        where: {
          id: item.id,
          currentSubmissionId: submissionId,
          status: "READY_FOR_REVIEW",
          reviewerId: actor.id,
        },
        data: { status: "CHANGES_REQUESTED", version: { increment: 1 } },
      });
      if (res.count !== 1) throw new ActionError(STALE_MESSAGE);
      await tx.workItemReview.create({
        data: {
          workItemId: item.id,
          submissionId,
          reviewerId: actor.id,
          decision: "CHANGES_REQUESTED",
          comment,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.CHANGES_REQUESTED,
        pageId: item.pageId,
        workItemId: item.id,
        summary: `Submission #${submission.submissionNumber}`,
        before: { status: "READY_FOR_REVIEW" },
        after: { status: "CHANGES_REQUESTED" },
        reason: comment,
      });
      await syncMirrorTicket(tx, item.ticketId, actor.id, { status: "CHANGES_REQUESTED" });
    });

    await notify({
      userIds: [item.assigneeId],
      actorId: actor.id,
      type: "REVIEW_CHANGES",
      title: `${actor.displayName} requested changes`,
      body: `${item.page.name} › ${item.title}: ${comment.slice(0, 140)}`,
      link: itemLink(item.pageId, item.id),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "requestChanges");
  }
}
