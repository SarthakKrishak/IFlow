import test from "node:test";
import assert from "node:assert/strict";
import {
  canAcknowledge,
  canCreateWorkItem,
  canEditWorkItem,
  canManageAssignment,
  canOverride,
  canReassign,
  canReview,
  derivePageLifecycle,
  pickColumnForStatus,
  statusForColumnName,
  validateChangeRequest,
  validateOwnerTransition,
  validateReviewerChoice,
  validateSubmission,
  validateTestingApproval,
  validateBugDeveloperTransition,
  isSafeHttpUrl,
  type Actor,
  type PolicyItem,
  type PolicySubmission,
} from "./policy";

const A: Actor = { id: "A", role: "MEMBER" }; // assignee
const B: Actor = { id: "B", role: "MEMBER" }; // other member
const C: Actor = { id: "C", role: "MEMBER" }; // reviewer
const LEAD: Actor = { id: "L", role: "MANAGER" };
const ADMIN: Actor = { id: "X", role: "ADMIN" };

const item = (over: Partial<PolicyItem> = {}): PolicyItem => ({
  assigneeId: "A",
  reviewerId: "C",
  status: "IN_PROGRESS",
  ownerAcknowledged: true,
  archivedAt: null,
  currentSubmissionId: "S1",
  requiresReview: true,
  ...over,
});
const sub = (over: Partial<PolicySubmission> = {}): PolicySubmission => ({
  id: "S1",
  submittedById: "A",
  status: "PENDING",
  ...over,
});

// 1–3: ownership
test("assignee can edit their own item", () => {
  assert.equal(canEditWorkItem(A, item()).ok, true);
});
test("another team member is rejected", () => {
  const d = canEditWorkItem(B, item());
  assert.equal(d.ok, false);
});
test("reviewer cannot edit the assignee's work", () => {
  assert.equal(canEditWorkItem(C, item()).ok, false);
});
test("leads and admins are NOT implicit editors (override is a separate path)", () => {
  assert.equal(canEditWorkItem(LEAD, item()).ok, false);
  assert.equal(canEditWorkItem(ADMIN, item()).ok, false);
  assert.equal(canOverride(ADMIN).ok, true);
  assert.equal(canOverride(LEAD).ok, false);
  assert.equal(canOverride(A).ok, false);
});
test("assignee is locked out while under review, when closed, archived, or unacknowledged", () => {
  assert.equal(canEditWorkItem(A, item({ status: "READY_FOR_REVIEW" })).ok, false);
  assert.equal(canEditWorkItem(A, item({ status: "DONE" })).ok, false);
  assert.equal(canEditWorkItem(A, item({ status: "CANCELLED" })).ok, false);
  assert.equal(canEditWorkItem(A, item({ archivedAt: new Date() })).ok, false);
  assert.equal(canEditWorkItem(A, item({ ownerAcknowledged: false })).ok, false);
});

// 7–10: reassignment
test("only leads/admins can reassign", () => {
  assert.equal(canReassign(B, item()).ok, false);
  assert.equal(canReassign(A, item()).ok, false);
  assert.equal(canReassign(LEAD, item()).ok, true);
  assert.equal(canReassign(ADMIN, item()).ok, true);
  assert.equal(canManageAssignment(B).ok, false);
});
test("reassignment flips edit rights immediately (A → B)", () => {
  const before = item({ assigneeId: "A" });
  const after = item({ assigneeId: "B" });
  assert.equal(canEditWorkItem(A, before).ok, true);
  assert.equal(canEditWorkItem(A, after).ok, false);
  assert.equal(canEditWorkItem(B, after).ok, true);
});
test("reassigned owner must acknowledge before editing", () => {
  const reassigned = item({ assigneeId: "B", ownerAcknowledged: false });
  assert.equal(canEditWorkItem(B, reassigned).ok, false);
  assert.equal(canAcknowledge(B, reassigned).ok, true);
  assert.equal(canAcknowledge(A, reassigned).ok, false);
});
test("closed items cannot be reassigned", () => {
  assert.equal(canReassign(LEAD, item({ status: "DONE" })).ok, false);
});

// creation permission is separate from edit permission
test("member creation: off by default, self-assign only when enabled", () => {
  const off = { membersCanCreate: false, archivedAt: null };
  const on = { membersCanCreate: true, archivedAt: null };
  assert.equal(canCreateWorkItem(B, off, "B").ok, false);
  assert.equal(canCreateWorkItem(B, on, "B").ok, true);
  assert.equal(canCreateWorkItem(B, on, "A").ok, false);
  assert.equal(canCreateWorkItem(LEAD, off, "A").ok, true);
  assert.equal(canCreateWorkItem(LEAD, { membersCanCreate: true, archivedAt: new Date() }, "A").ok, false);
});

// 5–6: review
test("reviewer can review a pending current submission", () => {
  assert.equal(canReview(C, item({ status: "READY_FOR_REVIEW" }), sub()).ok, true);
});
test("assignee cannot approve their own submission", () => {
  const i = item({ status: "READY_FOR_REVIEW", reviewerId: "A" });
  assert.equal(canReview(A, i, sub()).ok, false);
});
test("a non-reviewer cannot review", () => {
  assert.equal(canReview(B, item({ status: "READY_FOR_REVIEW" }), sub()).ok, false);
  assert.equal(canReview(LEAD, item({ status: "READY_FOR_REVIEW" }), sub()).ok, false);
});
test("older submissions cannot be approved after a newer one exists", () => {
  const i = item({ status: "READY_FOR_REVIEW", currentSubmissionId: "S2" });
  assert.equal(canReview(C, i, sub({ id: "S1" })).ok, false);
  assert.equal(canReview(C, i, sub({ id: "S2" })).ok, true);
});
test("an already-decided submission cannot be re-reviewed", () => {
  assert.equal(canReview(C, item({ status: "READY_FOR_REVIEW" }), sub({ status: "APPROVED" })).ok, false);
  assert.equal(canReview(C, item({ status: "CHANGES_REQUESTED" }), sub()).ok, false);
});
test("former assignee/submitter cannot become the reviewer", () => {
  assert.equal(validateReviewerChoice("A", "A", { requiresReview: true }).ok, false);
  assert.equal(validateReviewerChoice("A", "B", { requiresReview: true, submitterId: "A" }).ok, false);
  assert.equal(validateReviewerChoice(null, "B", { requiresReview: true }).ok, false);
  assert.equal(validateReviewerChoice(null, "B", { requiresReview: false }).ok, true);
  assert.equal(validateReviewerChoice("C", "B", { requiresReview: true }).ok, true);
});

// 12: change request needs a comment
test("change request requires a comment", () => {
  assert.equal(validateChangeRequest("").ok, false);
  assert.equal(validateChangeRequest("  ").ok, false);
  assert.equal(validateChangeRequest(undefined).ok, false);
  assert.equal(validateChangeRequest("Fix the spacing on mobile").ok, true);
});

// status machine
test("owner cannot jump to review/done or skip states", () => {
  assert.equal(validateOwnerTransition("NOT_STARTED", "IN_PROGRESS").ok, true);
  assert.equal(validateOwnerTransition("IN_PROGRESS", "DONE").ok, false);
  assert.equal(validateOwnerTransition("IN_PROGRESS", "READY_FOR_REVIEW").ok, false);
  assert.equal(validateOwnerTransition("NOT_STARTED", "DONE").ok, false);
  assert.equal(validateOwnerTransition("DONE", "IN_PROGRESS").ok, false);
  assert.equal(validateOwnerTransition("CHANGES_REQUESTED", "IN_PROGRESS").ok, true);
});
test("blocking needs a reason", () => {
  assert.equal(validateOwnerTransition("IN_PROGRESS", "BLOCKED").ok, false);
  assert.equal(validateOwnerTransition("IN_PROGRESS", "BLOCKED", "waiting on API").ok, true);
  assert.equal(validateOwnerTransition("BLOCKED", "IN_PROGRESS").ok, true);
});

// 11: evidence
test("submission without required evidence is rejected with feedback", () => {
  const dev = validateSubmission({ workstream: "DEVELOPMENT", summary: "Built it", evidence: [], testCases: [] });
  assert.ok(dev.length > 0);
  const ok1 = validateSubmission({
    workstream: "DEVELOPMENT",
    summary: "Built it",
    evidence: [{ type: "PR", url: "https://github.com/a/b/pull/1" }],
    testCases: [],
  });
  assert.deepEqual(ok1, []);
  // a screenshot alone does not satisfy development evidence
  const shot = validateSubmission({
    workstream: "DEVELOPMENT",
    summary: "Built it",
    evidence: [{ type: "SCREENSHOT", url: "https://x.com/a.png" }],
    testCases: [],
  });
  assert.ok(shot.length > 0);
  const design = validateSubmission({
    workstream: "DESIGN",
    summary: "Done",
    evidence: [{ type: "FIGMA", url: "https://figma.com/file/x" }],
    testCases: [],
  });
  assert.deepEqual(design, []);
});
test("unsafe evidence URLs are rejected", () => {
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,x"), false);
  assert.equal(isSafeHttpUrl("not a url"), false);
  assert.equal(isSafeHttpUrl("https://figma.com/x"), true);
  const errs = validateSubmission({
    workstream: "DESIGN",
    summary: "Done",
    evidence: [{ type: "FIGMA", url: "javascript:alert(1)" }],
    testCases: [],
  });
  assert.ok(errs.length > 0);
});
test("testing submission needs executed mandatory cases and actual results for failures", () => {
  const base = { workstream: "TESTING" as const, summary: "Ran suite", evidence: [] };
  assert.ok(validateSubmission({ ...base, testCases: [] }).length > 0);
  assert.ok(
    validateSubmission({
      ...base,
      testCases: [{ id: "1", title: "Login", isMandatory: true, result: "NOT_RUN" }],
    }).length > 0
  );
  assert.ok(
    validateSubmission({
      ...base,
      testCases: [{ id: "1", title: "Login", isMandatory: true, result: "FAIL", actual: "" }],
    }).length > 0
  );
  assert.deepEqual(
    validateSubmission({
      ...base,
      testCases: [
        { id: "1", title: "Login", isMandatory: true, result: "PASS" },
        { id: "2", title: "Optional", isMandatory: false, result: "NOT_RUN" },
      ],
    }),
    []
  );
});

// 15: testing gate
test("failed mandatory test blocks approval unless a lead records an exception", () => {
  const failing = [{ id: "1", title: "Checkout", isMandatory: true, result: "FAIL" as const }];
  assert.equal(validateTestingApproval(C, failing).ok, false);
  assert.equal(validateTestingApproval(LEAD, failing).ok, false);
  assert.equal(validateTestingApproval(LEAD, failing, "known issue, tracked in BUG-12").ok, true);
  // a plain member reviewer can never grant an exception
  assert.equal(validateTestingApproval(C, failing, "known issue, tracked in BUG-12").ok, false);
  const passing = [{ id: "1", title: "Checkout", isMandatory: true, result: "PASS" as const }];
  assert.equal(validateTestingApproval(C, passing).ok, true);
  const optionalFail = [{ id: "1", title: "Edge", isMandatory: false, result: "FAIL" as const }];
  assert.equal(validateTestingApproval(C, optionalFail).ok, true);
});

// bugs
test("bug developer transitions", () => {
  assert.equal(validateBugDeveloperTransition("ASSIGNED", "IN_PROGRESS").ok, true);
  assert.equal(validateBugDeveloperTransition("IN_PROGRESS", "READY_FOR_RETEST").ok, true);
  assert.equal(validateBugDeveloperTransition("ASSIGNED", "READY_FOR_RETEST").ok, false);
  assert.equal(validateBugDeveloperTransition("IN_PROGRESS", "VERIFIED").ok, false);
  assert.equal(validateBugDeveloperTransition("RETEST_FAILED", "IN_PROGRESS").ok, true);
});

// page lifecycle — percentages are not completion
const page = {
  designRequired: true,
  developmentRequired: true,
  testingRequired: true,
  requireFinalApproval: false,
  releasedAt: null,
};
const it = (workstream: "DESIGN" | "DEVELOPMENT" | "TESTING", status: any, isRequired = true) => ({
  workstream,
  status,
  isRequired,
  archivedAt: null,
});

test("100% design + 100% dev + 0% testing is NOT complete", () => {
  const r = derivePageLifecycle(
    page,
    [it("DESIGN", "DONE"), it("DEVELOPMENT", "DONE"), it("TESTING", "NOT_STARTED")],
    []
  );
  assert.equal(r.gatePassed, false);
  assert.equal(r.lifecycle, "READY_FOR_TESTING");
});
test("page with no work items is not started and cannot pass the gate", () => {
  const r = derivePageLifecycle(page, [], []);
  assert.equal(r.lifecycle, "NOT_STARTED");
  assert.equal(r.gatePassed, false);
});
test("completes only when all streams done and no blockers/bugs", () => {
  const items = [it("DESIGN", "DONE"), it("DEVELOPMENT", "DONE"), it("TESTING", "DONE")];
  assert.equal(derivePageLifecycle(page, items, []).lifecycle, "COMPLETED");
  const withBug = derivePageLifecycle(page, items, [{ status: "OPEN", releaseBlocking: true }]);
  assert.equal(withBug.gatePassed, false);
  assert.equal(withBug.lifecycle, "CHANGES_REQUIRED");
  const nonBlocking = derivePageLifecycle(page, items, [{ status: "OPEN", releaseBlocking: false }]);
  assert.equal(nonBlocking.lifecycle, "COMPLETED");
  const resolved = derivePageLifecycle(page, items, [{ status: "VERIFIED", releaseBlocking: true }]);
  assert.equal(resolved.lifecycle, "COMPLETED");
});
test("final approval gate", () => {
  const items = [it("DESIGN", "DONE"), it("DEVELOPMENT", "DONE"), it("TESTING", "DONE")];
  const need = { ...page, requireFinalApproval: true };
  assert.equal(derivePageLifecycle(need, items, []).lifecycle, "READY_FOR_RELEASE");
  assert.equal(derivePageLifecycle({ ...need, releasedAt: new Date() }, items, []).lifecycle, "COMPLETED");
});
test("optional (excluded) items don't gate completion; cancelled/archived ignored", () => {
  const items = [
    it("DESIGN", "DONE"),
    it("DEVELOPMENT", "DONE"),
    it("DEVELOPMENT", "IN_PROGRESS", false),
    it("TESTING", "DONE"),
    it("TESTING", "CANCELLED"),
    { ...it("TESTING", "NOT_STARTED"), archivedAt: new Date() },
  ];
  assert.equal(derivePageLifecycle(page, items, []).lifecycle, "COMPLETED");
});
test("blocked and changes-requested surface at page level", () => {
  assert.equal(
    derivePageLifecycle(page, [it("DESIGN", "BLOCKED"), it("DEVELOPMENT", "NOT_STARTED")], []).lifecycle,
    "BLOCKED"
  );
  assert.equal(
    derivePageLifecycle(page, [it("DESIGN", "CHANGES_REQUESTED")], []).lifecycle,
    "CHANGES_REQUIRED"
  );
});
test("stage progression", () => {
  assert.equal(derivePageLifecycle(page, [it("DESIGN", "IN_PROGRESS")], []).lifecycle, "DESIGN_IN_PROGRESS");
  assert.equal(derivePageLifecycle(page, [it("DESIGN", "DONE")], []).lifecycle, "READY_FOR_DEV");
  assert.equal(
    derivePageLifecycle(page, [it("DESIGN", "DONE"), it("DEVELOPMENT", "IN_PROGRESS")], []).lifecycle,
    "DEV_IN_PROGRESS"
  );
  assert.equal(
    derivePageLifecycle(
      page,
      [it("DESIGN", "DONE"), it("DEVELOPMENT", "DONE"), it("TESTING", "IN_PROGRESS")],
      []
    ).lifecycle,
    "TESTING_IN_PROGRESS"
  );
});

// kanban mapping
test("kanban column mapping", () => {
  const cols = [
    { id: "1", name: "To Do", order: 0 },
    { id: "2", name: "In Progress", order: 1 },
    { id: "3", name: "Review", order: 2 },
    { id: "4", name: "Done", order: 3 },
  ];
  assert.equal(pickColumnForStatus(cols, "NOT_STARTED")?.id, "1");
  assert.equal(pickColumnForStatus(cols, "IN_PROGRESS")?.id, "2");
  assert.equal(pickColumnForStatus(cols, "READY_FOR_REVIEW")?.id, "3");
  assert.equal(pickColumnForStatus(cols, "DONE")?.id, "4");
  assert.equal(pickColumnForStatus(cols, "CHANGES_REQUESTED")?.id, "2");
  assert.equal(pickColumnForStatus(cols, "BLOCKED")?.id, "2");
  assert.equal(statusForColumnName("Done"), "DONE");
  assert.equal(statusForColumnName("In Progress"), "IN_PROGRESS");
  assert.equal(statusForColumnName("Backlog"), "NOT_STARTED");
  assert.equal(statusForColumnName("Ideas"), null);
  const noReview = cols.filter((c) => c.name !== "Review");
  assert.equal(pickColumnForStatus(noReview, "READY_FOR_REVIEW")?.id, "2");
});
