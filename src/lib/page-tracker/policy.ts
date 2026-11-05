/**
 * Page Tracker — central authorization + workflow policy.
 *
 * Pure functions only (no DB / session access) so every rule is unit-testable
 * and every server action goes through the SAME checks. Server actions load
 * the records, derive the actor from the session, and call these helpers —
 * the client never supplies who is acting.
 */

import {
  BUG_RESOLVED,
  REQUIRED_EVIDENCE,
  type BugSeverity,
  type BugStatus,
  type EvidenceEntry,
  type PageLifecycle,
  type Role,
  type TestResult,
  type Workstream,
  type WorkItemStatus,
} from "./constants";

export interface Actor {
  id: string;
  role: Role;
}

export type Decision = { ok: true } | { ok: false; error: string };
const ok: Decision = { ok: true };
const deny = (error: string): Decision => ({ ok: false, error });

export const isAdmin = (a: Actor) => a.role === "ADMIN";
/** "Lead" = Manager or Admin. */
export const isLead = (a: Actor) => a.role === "ADMIN" || a.role === "MANAGER";

// ── Minimal record shapes the policy needs ──────────────────────────────────

export interface PolicyItem {
  assigneeId: string;
  reviewerId: string | null;
  status: WorkItemStatus;
  ownerAcknowledged: boolean;
  archivedAt: Date | null;
  currentSubmissionId: string | null;
  requiresReview: boolean;
}

export interface PolicySubmission {
  id: string;
  submittedById: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
}

const CLOSED: WorkItemStatus[] = ["DONE", "CANCELLED"];

// ── Page / work item creation & management ──────────────────────────────────

export function canManagePage(actor: Actor): Decision {
  return isLead(actor) ? ok : deny("Only a lead or admin can manage pages");
}

export function canCreateWorkItem(
  actor: Actor,
  page: { membersCanCreate: boolean; archivedAt: Date | null },
  assigneeId: string
): Decision {
  if (page.archivedAt) return deny("This page is archived");
  if (isLead(actor)) return ok;
  if (!page.membersCanCreate) {
    return deny("Only a lead or admin can create work items on this page");
  }
  // Creation never grants the power to hand work to someone else.
  if (assigneeId !== actor.id) {
    return deny("Team members can only create work items assigned to themselves");
  }
  return ok;
}

/** Assignment, reviewer, workstream/page, completion-gate, cancel/archive. */
export function canManageAssignment(actor: Actor): Decision {
  return isLead(actor) ? ok : deny("Only a lead or admin can change assignment");
}

export function canOverride(actor: Actor): Decision {
  return isAdmin(actor) ? ok : deny("Only an admin can use an administrative override");
}

// ── Owner-controlled mutations ──────────────────────────────────────────────

/**
 * THE central rule: only the current assignee may change operational details,
 * status, evidence, notes, test results, or submit. Reviewers, leads and
 * other members are rejected here — admin overrides are a separate, audited
 * code path (see `canOverride`).
 */
export function canEditWorkItem(actor: Actor, item: PolicyItem): Decision {
  if (item.assigneeId !== actor.id) {
    return deny("Only the assigned owner can modify this work item");
  }
  if (item.archivedAt) return deny("This work item is archived");
  if (CLOSED.includes(item.status)) {
    return deny(`This work item is ${item.status === "DONE" ? "done" : "cancelled"} and can no longer be edited`);
  }
  if (!item.ownerAcknowledged) {
    return deny("You were assigned this work item — acknowledge ownership before changing it");
  }
  if (item.status === "READY_FOR_REVIEW") {
    return deny("This work item is under review — wait for the decision before changing it");
  }
  return ok;
}

export function canAcknowledge(actor: Actor, item: PolicyItem): Decision {
  if (item.assigneeId !== actor.id) return deny("Only the assigned owner can acknowledge ownership");
  if (item.ownerAcknowledged) return deny("Ownership is already acknowledged");
  return ok;
}

const OWNER_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED"],
  BLOCKED: ["IN_PROGRESS"],
  CHANGES_REQUESTED: ["IN_PROGRESS"],
  READY_FOR_REVIEW: [],
  DONE: [],
  CANCELLED: [],
};

/**
 * Statuses the assignee may move to directly. READY_FOR_REVIEW and DONE are
 * deliberately NOT reachable here: they only come from submit / review.
 */
export function validateOwnerTransition(
  from: WorkItemStatus,
  to: WorkItemStatus,
  reason?: string | null
): Decision {
  if (!OWNER_TRANSITIONS[from].includes(to)) {
    return deny(`Cannot move from ${from.replace(/_/g, " ").toLowerCase()} to ${to.replace(/_/g, " ").toLowerCase()}`);
  }
  if (to === "BLOCKED" && !(reason && reason.trim().length >= 3)) {
    return deny("A reason is required when blocking a work item");
  }
  return ok;
}

export function canSubmit(item: PolicyItem): Decision {
  if (item.status !== "IN_PROGRESS" && item.status !== "CHANGES_REQUESTED") {
    return deny("Start the work (In Progress) before submitting it");
  }
  return ok;
}

// ── Reassignment / reviewer ─────────────────────────────────────────────────

export function canReassign(actor: Actor, item: PolicyItem): Decision {
  const d = canManageAssignment(actor);
  if (!d.ok) return d;
  if (item.archivedAt) return deny("This work item is archived");
  if (CLOSED.includes(item.status)) return deny("Closed work items cannot be reassigned");
  return ok;
}

export function validateReviewerChoice(
  reviewerId: string | null,
  assigneeId: string,
  opts: { requiresReview: boolean; submitterId?: string | null }
): Decision {
  if (!reviewerId) {
    return opts.requiresReview ? deny("A reviewer is required when review is mandatory") : ok;
  }
  if (reviewerId === assigneeId) return deny("The reviewer must be a different person than the assignee");
  if (opts.submitterId && reviewerId === opts.submitterId) {
    return deny("The person who submitted the work cannot review it");
  }
  return ok;
}

// ── Review ──────────────────────────────────────────────────────────────────

/**
 * Reviewer-controlled actions. Enforces: assigned reviewer only, no
 * self-approval, and the decision must target the CURRENT pending submission
 * (an older version can never be approved after a newer one exists).
 */
export function canReview(actor: Actor, item: PolicyItem, submission: PolicySubmission): Decision {
  if (item.archivedAt) return deny("This work item is archived");
  if (!item.reviewerId || item.reviewerId !== actor.id) {
    return deny("Only the assigned reviewer can review this submission");
  }
  if (submission.submittedById === actor.id || item.assigneeId === actor.id) {
    return deny("You cannot review your own submission");
  }
  if (item.currentSubmissionId !== submission.id) {
    return deny("This submission has been superseded by a newer version");
  }
  if (submission.status !== "PENDING" || item.status !== "READY_FOR_REVIEW") {
    return deny("This submission is not awaiting review");
  }
  return ok;
}

export function validateChangeRequest(comment: string | null | undefined): Decision {
  return comment && comment.trim().length >= 3
    ? ok
    : deny("Please explain what needs to change — a comment is required");
}

// ── Evidence & submission validation ────────────────────────────────────────

const URL_PROTOCOLS = new Set(["http:", "https:"]);

/** Only http(s) URLs are accepted/rendered — blocks javascript:, data:, etc. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return URL_PROTOCOLS.has(u.protocol) && u.hostname.length > 0;
  } catch {
    return false;
  }
}

export interface TestCaseLike {
  id: string;
  title: string;
  isMandatory: boolean;
  result: TestResult;
  actual?: string | null;
}

/** Returns a list of human-readable problems; empty means ready to submit. */
export function validateSubmission(input: {
  workstream: Workstream;
  summary: string;
  evidence: EvidenceEntry[];
  testCases: TestCaseLike[];
}): string[] {
  const errors: string[] = [];
  if (!input.summary || input.summary.trim().length < 3) {
    errors.push("Add a short summary of what you completed");
  }
  for (const e of input.evidence) {
    if (!isSafeHttpUrl(e.url)) errors.push(`Evidence link is not a valid http(s) URL: ${e.url}`);
  }
  const wanted = REQUIRED_EVIDENCE[input.workstream];
  if (wanted.length > 0 && !input.evidence.some((e) => wanted.includes(e.type))) {
    errors.push(
      `Attach at least one evidence link (${wanted.join(", ").toLowerCase().replace(/_/g, " ")}) before submitting`
    );
  }
  if (input.workstream === "TESTING") {
    if (input.testCases.length === 0) {
      errors.push("Add at least one test case before submitting");
    }
    for (const tc of input.testCases) {
      if (tc.isMandatory && tc.result === "NOT_RUN") {
        errors.push(`Mandatory test case not run: "${tc.title}"`);
      }
      if ((tc.result === "FAIL" || tc.result === "BLOCKED") && !(tc.actual && tc.actual.trim())) {
        errors.push(`Record the actual result for "${tc.title}"`);
      }
    }
  }
  return errors;
}

/**
 * Testing approval gate: every mandatory test case must PASS. A lead/admin
 * reviewer may approve anyway by recording an explicit exception reason.
 */
export function validateTestingApproval(
  actor: Actor,
  snapshot: TestCaseLike[] | null,
  exceptionReason?: string | null
): Decision {
  const failing = (snapshot ?? []).filter((t) => t.isMandatory && t.result !== "PASS");
  if (failing.length === 0) return ok;
  const names = failing.map((t) => `"${t.title}" (${t.result.toLowerCase().replace("_", " ")})`).join(", ");
  if (!exceptionReason || exceptionReason.trim().length < 5) {
    return deny(
      `Mandatory test cases have not passed: ${names}. ` +
        (isLead(actor)
          ? "Record an exception reason to approve anyway, or request changes."
          : "Request changes, or ask a lead to record an exception.")
    );
  }
  if (!isLead(actor)) {
    return deny("Only a lead or admin can record an exception for failing mandatory tests");
  }
  return ok;
}

// ── Bugs ────────────────────────────────────────────────────────────────────

const BUG_TRANSITIONS_ASSIGNEE: Partial<Record<BugStatus, BugStatus[]>> = {
  OPEN: ["IN_PROGRESS"],
  TRIAGED: ["IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS"],
  RETEST_FAILED: ["IN_PROGRESS"],
  IN_PROGRESS: ["READY_FOR_RETEST"],
};

export function validateBugDeveloperTransition(from: BugStatus, to: BugStatus): Decision {
  return BUG_TRANSITIONS_ASSIGNEE[from]?.includes(to)
    ? ok
    : deny(`A bug cannot move from ${from.replace(/_/g, " ").toLowerCase()} to ${to.replace(/_/g, " ").toLowerCase()}`);
}

export function isBugResolved(status: BugStatus): boolean {
  return BUG_RESOLVED.includes(status);
}

export function defaultReleaseBlocking(severity: BugSeverity): boolean {
  return severity === "HIGH" || severity === "CRITICAL";
}

// ── Page lifecycle / completion gate ────────────────────────────────────────

export interface LifecycleItem {
  workstream: Workstream;
  status: WorkItemStatus;
  isRequired: boolean;
  archivedAt: Date | null;
}
export interface LifecycleBug {
  status: BugStatus;
  releaseBlocking: boolean;
}
export interface LifecyclePage {
  designRequired: boolean;
  developmentRequired: boolean;
  testingRequired: boolean;
  requireFinalApproval: boolean;
  releasedAt: Date | null;
}

export interface WorkstreamSummary {
  total: number;
  done: number;
  inProgress: number;
  inReview: number;
  blocked: number;
  changes: number;
  notStarted: number;
  /** Informational only — NEVER proof of completion. */
  progressPct: number;
  required: boolean;
  /** All required items are DONE (and at least one exists). */
  complete: boolean;
  started: boolean;
}

const activeItems = (items: LifecycleItem[]) =>
  items.filter((i) => !i.archivedAt && i.status !== "CANCELLED");

export function summarizeWorkstream(
  items: LifecycleItem[],
  workstream: Workstream,
  required: boolean
): WorkstreamSummary {
  const list = activeItems(items).filter((i) => i.workstream === workstream);
  const count = (s: WorkItemStatus) => list.filter((i) => i.status === s).length;
  const requiredList = list.filter((i) => i.isRequired);
  const done = count("DONE");
  return {
    total: list.length,
    done,
    inProgress: count("IN_PROGRESS"),
    inReview: count("READY_FOR_REVIEW"),
    blocked: count("BLOCKED"),
    changes: count("CHANGES_REQUESTED"),
    notStarted: count("NOT_STARTED"),
    progressPct: list.length ? Math.round((done / list.length) * 100) : 0,
    required,
    complete: requiredList.length > 0 && requiredList.every((i) => i.status === "DONE"),
    started: list.some((i) => i.status !== "NOT_STARTED"),
  };
}

export interface PageLifecycleResult {
  lifecycle: PageLifecycle;
  gatePassed: boolean;
  gateProblems: string[];
  streams: Record<Workstream, WorkstreamSummary>;
}

/**
 * Completion is NOT an average of percentages. A page is complete only when
 * every required stream is fully done, nothing is blocked, no release-blocking
 * bug is open, and (if configured) the release was approved.
 */
export function derivePageLifecycle(
  page: LifecyclePage,
  items: LifecycleItem[],
  bugs: LifecycleBug[]
): PageLifecycleResult {
  const streams = {
    DESIGN: summarizeWorkstream(items, "DESIGN", page.designRequired),
    DEVELOPMENT: summarizeWorkstream(items, "DEVELOPMENT", page.developmentRequired),
    TESTING: summarizeWorkstream(items, "TESTING", page.testingRequired),
  };

  const gateProblems: string[] = [];
  (Object.keys(streams) as Workstream[]).forEach((ws) => {
    const s = streams[ws];
    if (s.required && !s.complete) {
      const label = ws === "DESIGN" ? "Design" : ws === "DEVELOPMENT" ? "Development" : "Testing";
      gateProblems.push(s.total === 0 ? `${label} has no work items` : `${label} work is not finished`);
    }
  });
  const blockedCount = activeItems(items).filter((i) => i.status === "BLOCKED").length;
  if (blockedCount > 0) gateProblems.push(`${blockedCount} blocked work item${blockedCount > 1 ? "s" : ""}`);
  const blockingBugs = bugs.filter((b) => b.releaseBlocking && !isBugResolved(b.status)).length;
  if (blockingBugs > 0) gateProblems.push(`${blockingBugs} open release-blocking bug${blockingBugs > 1 ? "s" : ""}`);

  const gatePassed = gateProblems.length === 0;

  let lifecycle: PageLifecycle;
  const anyChanges = activeItems(items).some((i) => i.status === "CHANGES_REQUESTED");
  const openBugs = bugs.some((b) => !isBugResolved(b.status) && b.releaseBlocking);

  if (gatePassed) {
    lifecycle = page.requireFinalApproval && !page.releasedAt ? "READY_FOR_RELEASE" : "COMPLETED";
  } else if (blockedCount > 0) {
    lifecycle = "BLOCKED";
  } else if (anyChanges || openBugs) {
    lifecycle = "CHANGES_REQUIRED";
  } else {
    const designDone = !page.designRequired || streams.DESIGN.complete;
    const devDone = !page.developmentRequired || streams.DEVELOPMENT.complete;
    if (streams.TESTING.started) lifecycle = "TESTING_IN_PROGRESS";
    else if (devDone && streams.DEVELOPMENT.total > 0 && designDone) lifecycle = "READY_FOR_TESTING";
    else if (streams.DEVELOPMENT.started) lifecycle = "DEV_IN_PROGRESS";
    else if (designDone && streams.DESIGN.total > 0) lifecycle = "READY_FOR_DEV";
    else if (streams.DESIGN.started) lifecycle = "DESIGN_IN_PROGRESS";
    else lifecycle = "NOT_STARTED";
  }

  return { lifecycle, gatePassed, gateProblems, streams };
}

// ── Kanban column mapping ───────────────────────────────────────────────────

/** Statuses the assignee may set by dragging the mirrored Kanban card. */
export const KANBAN_DRAGGABLE: WorkItemStatus[] = ["NOT_STARTED", "IN_PROGRESS"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Which work-item status a Kanban column name represents (null = unknown). */
export function statusForColumnName(name: string): WorkItemStatus | null {
  const n = norm(name);
  if (/done|complet/.test(n)) return "DONE";
  if (/review|qa|testing/.test(n)) return "READY_FOR_REVIEW";
  if (/block/.test(n)) return "BLOCKED";
  if (/progress|doing|develop|wip/.test(n)) return "IN_PROGRESS";
  if (/todo|backlog|open|new|queue|planned/.test(n)) return "NOT_STARTED";
  return null;
}

/** Best column for a status on a board (by name, ordered columns). */
export function pickColumnForStatus<T extends { id: string; name: string; order: number }>(
  columns: T[],
  status: WorkItemStatus
): T | null {
  const sorted = [...columns].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  const want: WorkItemStatus =
    status === "CHANGES_REQUESTED" ? "IN_PROGRESS" : status === "CANCELLED" ? "DONE" : status;
  const exact = sorted.find((c) => statusForColumnName(c.name) === want);
  if (exact) return exact;
  if (want === "NOT_STARTED") return sorted[0];
  if (want === "BLOCKED") return sorted.find((c) => statusForColumnName(c.name) === "IN_PROGRESS") ?? null;
  if (want === "READY_FOR_REVIEW") return sorted.find((c) => statusForColumnName(c.name) === "IN_PROGRESS") ?? null;
  return null;
}
