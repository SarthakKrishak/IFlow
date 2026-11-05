"use server";

import { z } from "zod";
import { ACTION, type BugStatus } from "@/lib/page-tracker/constants";
import {
  canManageAssignment,
  defaultReleaseBlocking,
  isBugResolved,
  validateBugDeveloperTransition,
} from "@/lib/page-tracker/policy";
import {
  ActionError,
  assertAssignable,
  denied,
  done,
  fail,
  itemLink,
  loadItemForOwnerEdit,
  notify,
  prisma,
  requireActor,
  toResult,
  writeAudit,
  type Result,
} from "@/lib/page-tracker/server";
import {
  addTestCaseSchema,
  bugNoteSchema,
  createBugSchema,
  recordResultSchema,
  retestSchema,
  triageBugSchema,
  updateTestCaseSchema,
} from "@/lib/page-tracker/validators";

const idSchema = z.string().cuid();

// ── Test cases (owned by the Testing work item's assignee) ──────────────────

export async function addTestCase(input: z.input<typeof addTestCaseSchema>): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireActor();
    const parsed = addTestCaseSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { workItemId, testCase } = parsed.data;

    const item = await loadItemForOwnerEdit(workItemId, actor);
    if (item.workstream !== "TESTING") return fail("Test cases can only be added to Testing work items");

    const tc = await prisma.$transaction(async (tx) => {
      const max = await tx.testCase.aggregate({ where: { workItemId }, _max: { order: true } });
      const created = await tx.testCase.create({
        data: {
          workItemId,
          title: testCase.title,
          preconditions: testCase.preconditions || null,
          steps: testCase.steps || null,
          expected: testCase.expected || null,
          isMandatory: testCase.isMandatory,
          order: (max._max.order ?? -1) + 1,
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.TEST_CASE_ADDED,
        pageId: item.pageId,
        workItemId,
        summary: created.title,
      });
      return created;
    });
    return done({ id: tc.id });
  } catch (e) {
    return toResult(e, "addTestCase");
  }
}

async function loadCase(testCaseId: string) {
  const tc = await prisma.testCase.findUnique({ where: { id: testCaseId } });
  if (!tc) throw new ActionError("Test case not found");
  return tc;
}

export async function updateTestCase(input: z.input<typeof updateTestCaseSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = updateTestCaseSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { testCaseId, changes } = parsed.data;
    const tc = await loadCase(testCaseId);
    const item = await loadItemForOwnerEdit(tc.workItemId, actor);

    const data = {
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.preconditions !== undefined && { preconditions: changes.preconditions || null }),
      ...(changes.steps !== undefined && { steps: changes.steps || null }),
      ...(changes.expected !== undefined && { expected: changes.expected || null }),
      ...(changes.isMandatory !== undefined && { isMandatory: changes.isMandatory }),
    };
    if (Object.keys(data).length === 0) return done(undefined);
    await prisma.$transaction(async (tx) => {
      await tx.testCase.update({ where: { id: testCaseId }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.TEST_CASE_UPDATED,
        pageId: item.pageId,
        workItemId: item.id,
        summary: tc.title,
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "updateTestCase");
  }
}

export async function deleteTestCase(input: { testCaseId: string }): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const id = idSchema.safeParse(input?.testCaseId);
    if (!id.success) return fail("Invalid request");
    const tc = await loadCase(id.data);
    const item = await loadItemForOwnerEdit(tc.workItemId, actor);
    const bugs = await prisma.trackerBug.count({ where: { testCaseId: tc.id } });
    if (bugs > 0) return fail("This test case has linked bugs and cannot be removed");
    await prisma.$transaction(async (tx) => {
      await tx.testCase.delete({ where: { id: tc.id } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.TEST_CASE_REMOVED,
        pageId: item.pageId,
        workItemId: item.id,
        summary: tc.title,
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "deleteTestCase");
  }
}

export async function recordTestResult(input: z.input<typeof recordResultSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = recordResultSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const v = parsed.data;
    const tc = await loadCase(v.testCaseId);
    const item = await loadItemForOwnerEdit(tc.workItemId, actor);
    if (item.status !== "IN_PROGRESS") return fail("Start the work (In Progress) before recording results");
    if ((v.result === "FAIL" || v.result === "BLOCKED") && !(v.actual && v.actual.trim())) {
      return fail("Describe the actual result for a failed or blocked test");
    }

    await prisma.$transaction(async (tx) => {
      await tx.testCase.update({
        where: { id: tc.id },
        data: {
          result: v.result,
          actual: v.actual || null,
          environment: v.environment || null,
          buildVersion: v.buildVersion || null,
          evidenceUrl: v.evidenceUrl || null,
          testedById: v.result === "NOT_RUN" ? null : actor.id,
          testedAt: v.result === "NOT_RUN" ? null : new Date(),
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.TEST_RESULT_RECORDED,
        pageId: item.pageId,
        workItemId: item.id,
        summary: tc.title,
        before: { result: tc.result },
        after: { result: v.result },
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "recordTestResult");
  }
}

// ── Bugs ────────────────────────────────────────────────────────────────────

const bugLink = (pageId: string, workItemId: string | null) =>
  workItemId ? itemLink(pageId, workItemId) : `/page-tracker/${pageId}?tab=bugs`;

export async function createBug(input: z.input<typeof createBugSchema>): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireActor();
    const parsed = createBugSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const v = parsed.data;

    const page = await prisma.trackerPage.findUnique({ where: { id: v.pageId }, select: { id: true, name: true, archivedAt: true } });
    if (!page) return fail("Page not found");
    if (page.archivedAt) return fail("This page is archived");

    let testWorkItemId = v.testWorkItemId ?? null;
    const testCaseId = v.testCaseId ?? null;

    if (testCaseId) {
      // Failed-test bug: only the tester who owns that Testing item may file it.
      const tc = await prisma.testCase.findUnique({
        where: { id: testCaseId },
        include: { workItem: { select: { id: true, pageId: true, assigneeId: true, workstream: true } } },
      });
      if (!tc || tc.workItem.pageId !== page.id) return fail("Test case not found on this page");
      if (tc.workItem.assigneeId !== actor.id) {
        return fail("Only the assigned tester can file a bug from this test case");
      }
      if (tc.result !== "FAIL") return fail("Record the test as Failed before filing a bug from it");
      const dup = await prisma.trackerBug.count({
        where: { testCaseId, status: { notIn: ["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"] } },
      });
      if (dup > 0) return fail("An open bug already exists for this test case");
      testWorkItemId = tc.workItem.id;
    } else if (testWorkItemId) {
      const tw = await prisma.workItem.findUnique({
        where: { id: testWorkItemId },
        select: { pageId: true, workstream: true },
      });
      if (!tw || tw.pageId !== page.id || tw.workstream !== "TESTING") return fail("Invalid Testing work item");
    }

    let devItem: { id: string; assigneeId: string } | null = null;
    if (v.devWorkItemId) {
      const dw = await prisma.workItem.findUnique({
        where: { id: v.devWorkItemId },
        select: { id: true, pageId: true, workstream: true, assigneeId: true },
      });
      if (!dw || dw.pageId !== page.id || dw.workstream !== "DEVELOPMENT") {
        return fail("The related item must be a Development work item on this page");
      }
      devItem = dw;
    }

    const assigneeId = v.assigneeId ?? devItem?.assigneeId ?? null;
    if (assigneeId) await assertAssignable(assigneeId, "bug assignee");

    const bug = await prisma.$transaction(async (tx) => {
      const b = await tx.trackerBug.create({
        data: {
          pageId: page.id,
          testWorkItemId,
          testCaseId,
          devWorkItemId: devItem?.id ?? null,
          title: v.title,
          description: v.description || null,
          stepsToReproduce: v.stepsToReproduce || null,
          expectedResult: v.expectedResult || null,
          actualResult: v.actualResult || null,
          severity: v.severity,
          priority: v.priority,
          status: assigneeId ? "ASSIGNED" : "OPEN",
          assigneeId,
          reporterId: actor.id,
          environment: v.environment || null,
          buildVersion: v.buildVersion || null,
          evidenceUrl: v.evidenceUrl || null,
          releaseBlocking: defaultReleaseBlocking(v.severity),
        },
      });
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.BUG_CREATED,
        pageId: page.id,
        workItemId: testWorkItemId,
        bugId: b.id,
        summary: `${b.title} (${b.severity})`,
      });
      return b;
    });

    await notify({
      userIds: [assigneeId],
      actorId: actor.id,
      type: "BUG_ASSIGNED",
      title: `${actor.displayName} assigned you a ${v.severity.toLowerCase()} bug`,
      body: `${page.name}: ${bug.title}`,
      link: bugLink(page.id, devItem?.id ?? testWorkItemId),
    });
    return done({ id: bug.id });
  } catch (e) {
    return toResult(e, "createBug");
  }
}

async function loadBug(bugId: string) {
  const bug = await prisma.trackerBug.findUnique({
    where: { id: bugId },
    include: {
      page: { select: { id: true, name: true, archivedAt: true } },
      testWorkItem: { select: { id: true, assigneeId: true } },
    },
  });
  if (!bug) throw new ActionError("Bug not found");
  if (bug.page.archivedAt) throw new ActionError("This page is archived");
  return bug;
}

/** Lead-controlled triage: assignment, severity, release-blocking flag, won't fix / duplicate / close. */
export async function triageBug(input: z.input<typeof triageBugSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const d = denied(canManageAssignment(actor));
    if (d) return d;
    const parsed = triageBugSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const { bugId, changes } = parsed.data;
    const bug = await loadBug(bugId);
    if (isBugResolved(bug.status) && bug.status !== "VERIFIED") return fail("This bug is already resolved");

    if (changes.assigneeId) await assertAssignable(changes.assigneeId, "bug assignee");
    if (changes.devWorkItemId) {
      const dw = await prisma.workItem.findUnique({
        where: { id: changes.devWorkItemId },
        select: { pageId: true, workstream: true },
      });
      if (!dw || dw.pageId !== bug.pageId || dw.workstream !== "DEVELOPMENT") {
        return fail("The related item must be a Development work item on this page");
      }
    }
    if (changes.status === "CLOSED" && bug.status !== "VERIFIED") {
      return fail("Only a verified bug can be closed");
    }
    if (bug.status === "VERIFIED" && changes.status && changes.status !== "CLOSED") {
      return fail("A verified bug can only be closed");
    }

    let status: BugStatus | undefined = changes.status;
    if (!status && changes.assigneeId !== undefined && ["OPEN", "TRIAGED", "ASSIGNED"].includes(bug.status)) {
      status = changes.assigneeId ? "ASSIGNED" : "TRIAGED";
    }
    const data = {
      ...(changes.assigneeId !== undefined && { assigneeId: changes.assigneeId }),
      ...(changes.devWorkItemId !== undefined && { devWorkItemId: changes.devWorkItemId }),
      ...(changes.severity !== undefined && { severity: changes.severity }),
      ...(changes.priority !== undefined && { priority: changes.priority }),
      ...(changes.releaseBlocking !== undefined && { releaseBlocking: changes.releaseBlocking }),
      ...(status !== undefined && { status }),
    };
    if (Object.keys(data).length === 0) return done(undefined);

    await prisma.$transaction(async (tx) => {
      await tx.trackerBug.update({ where: { id: bugId }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        action: status && status !== bug.status ? ACTION.BUG_STATUS_CHANGED : ACTION.BUG_UPDATED,
        pageId: bug.pageId,
        workItemId: bug.testWorkItemId,
        bugId,
        summary: bug.title,
        before: { status: bug.status, assigneeId: bug.assigneeId, severity: bug.severity },
        after: JSON.parse(JSON.stringify(data)),
      });
    });
    if (changes.assigneeId && changes.assigneeId !== bug.assigneeId) {
      await notify({
        userIds: [changes.assigneeId],
        actorId: actor.id,
        type: "BUG_ASSIGNED",
        title: `${actor.displayName} assigned you a bug`,
        body: `${bug.page.name}: ${bug.title}`,
        link: bugLink(bug.pageId, bug.devWorkItemId ?? bug.testWorkItemId),
      });
    }
    return done(undefined);
  } catch (e) {
    return toResult(e, "triageBug");
  }
}

/** Assigned developer: pick the bug up (→ In Progress). */
export async function startBugFix(input: z.input<typeof bugNoteSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = bugNoteSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const bug = await loadBug(parsed.data.bugId);
    if (bug.assigneeId !== actor.id) return fail("Only the assigned developer can work on this bug");
    const t = validateBugDeveloperTransition(bug.status, "IN_PROGRESS");
    if (!t.ok) return fail(t.error);
    await prisma.$transaction(async (tx) => {
      const res = await tx.trackerBug.updateMany({
        where: { id: bug.id, status: bug.status, assigneeId: actor.id },
        data: { status: "IN_PROGRESS" },
      });
      if (res.count !== 1) throw new ActionError("This bug was changed by someone else — reload and retry");
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.BUG_STATUS_CHANGED,
        pageId: bug.pageId,
        workItemId: bug.testWorkItemId,
        bugId: bug.id,
        summary: bug.title,
        before: { status: bug.status },
        after: { status: "IN_PROGRESS" },
      });
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "startBugFix");
  }
}

/** Assigned developer: fix is ready → notify the tester. */
export async function submitBugForRetest(input: z.input<typeof bugNoteSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = bugNoteSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const bug = await loadBug(parsed.data.bugId);
    if (bug.assigneeId !== actor.id) return fail("Only the assigned developer can submit this bug for retest");
    const t = validateBugDeveloperTransition(bug.status, "READY_FOR_RETEST");
    if (!t.ok) return fail(t.error);
    await prisma.$transaction(async (tx) => {
      const res = await tx.trackerBug.updateMany({
        where: { id: bug.id, status: "IN_PROGRESS", assigneeId: actor.id },
        data: { status: "READY_FOR_RETEST" },
      });
      if (res.count !== 1) throw new ActionError("This bug was changed by someone else — reload and retry");
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.BUG_STATUS_CHANGED,
        pageId: bug.pageId,
        workItemId: bug.testWorkItemId,
        bugId: bug.id,
        summary: bug.title,
        before: { status: "IN_PROGRESS" },
        after: { status: "READY_FOR_RETEST" },
        reason: parsed.data.note || null,
      });
    });
    await notify({
      userIds: [bug.reporterId, bug.testWorkItem?.assigneeId],
      actorId: actor.id,
      type: "BUG_RETEST",
      title: `${actor.displayName} fixed a bug — ready for retest`,
      body: `${bug.page.name}: ${bug.title}`,
      link: bugLink(bug.pageId, bug.testWorkItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "submitBugForRetest");
  }
}

/** Tester (reporter / owner of the Testing item) verifies or bounces the fix. */
export async function retestBug(input: z.input<typeof retestSchema>): Promise<Result<void>> {
  try {
    const actor = await requireActor();
    const parsed = retestSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request");
    const { bugId, passed, note } = parsed.data;
    const bug = await loadBug(bugId);
    const isTester = bug.reporterId === actor.id || bug.testWorkItem?.assigneeId === actor.id;
    if (!isTester) return fail("Only the tester who reported this bug can record the retest");
    if (bug.status !== "READY_FOR_RETEST") return fail("This bug is not ready for retest");
    if (!passed && !(note && note.trim().length >= 3)) {
      return fail("Describe what still fails so the developer can fix it");
    }
    const next = passed ? "VERIFIED" : "RETEST_FAILED";
    await prisma.$transaction(async (tx) => {
      const res = await tx.trackerBug.updateMany({
        where: { id: bug.id, status: "READY_FOR_RETEST" },
        data: { status: next, verifiedAt: passed ? new Date() : null },
      });
      if (res.count !== 1) throw new ActionError("This bug was changed by someone else — reload and retry");
      await writeAudit(tx, {
        actorId: actor.id,
        action: ACTION.BUG_STATUS_CHANGED,
        pageId: bug.pageId,
        workItemId: bug.testWorkItemId,
        bugId: bug.id,
        summary: bug.title,
        before: { status: "READY_FOR_RETEST" },
        after: { status: next },
        reason: note || null,
      });
    });
    await notify({
      userIds: [bug.assigneeId],
      actorId: actor.id,
      type: "BUG_RETEST_RESULT",
      title: passed ? `${actor.displayName} verified your fix` : `${actor.displayName}: retest failed`,
      body: `${bug.page.name}: ${bug.title}${!passed && note ? ` — ${note.slice(0, 120)}` : ""}`,
      link: bugLink(bug.pageId, bug.devWorkItemId ?? bug.testWorkItemId),
    });
    return done(undefined);
  } catch (e) {
    return toResult(e, "retestBug");
  }
}
