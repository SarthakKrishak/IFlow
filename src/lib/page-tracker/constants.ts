/**
 * Page Tracker — shared vocabulary (no server/DB imports so it is safe to use
 * from both server actions and client components).
 */

export type Role = "ADMIN" | "MANAGER" | "MEMBER";
export type Workstream = "DESIGN" | "DEVELOPMENT" | "TESTING";
export type WorkItemStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "READY_FOR_REVIEW"
  | "CHANGES_REQUESTED"
  | "DONE"
  | "CANCELLED";
export type TestResult = "NOT_RUN" | "PASS" | "FAIL" | "BLOCKED";
export type BugSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type BugStatus =
  | "OPEN"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "READY_FOR_RETEST"
  | "RETEST_FAILED"
  | "VERIFIED"
  | "CLOSED"
  | "WONT_FIX"
  | "DUPLICATE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type PageLifecycle =
  | "NOT_STARTED"
  | "DESIGN_IN_PROGRESS"
  | "READY_FOR_DEV"
  | "DEV_IN_PROGRESS"
  | "READY_FOR_TESTING"
  | "TESTING_IN_PROGRESS"
  | "CHANGES_REQUIRED"
  | "READY_FOR_RELEASE"
  | "COMPLETED"
  | "BLOCKED";

export const WORKSTREAMS: Workstream[] = ["DESIGN", "DEVELOPMENT", "TESTING"];

export const WORKSTREAM_LABEL: Record<Workstream, string> = {
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  TESTING: "Testing",
};

export const WORKSTREAM_COLOR: Record<Workstream, string> = {
  DESIGN: "#EC6A52",
  DEVELOPMENT: "#5B5FEF",
  TESTING: "#1EAE7C",
};

export const STATUS_LABEL: Record<WorkItemStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  READY_FOR_REVIEW: "In Review",
  CHANGES_REQUESTED: "Changes Requested",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const STATUS_COLOR: Record<WorkItemStatus, string> = {
  NOT_STARTED: "#9AA1AE",
  IN_PROGRESS: "#3B82F6",
  BLOCKED: "#D1495B",
  READY_FOR_REVIEW: "#A855F7",
  CHANGES_REQUESTED: "#F59E0B",
  DONE: "#1EAE7C",
  CANCELLED: "#6B7280",
};

export const LIFECYCLE_LABEL: Record<PageLifecycle, string> = {
  NOT_STARTED: "Not Started",
  DESIGN_IN_PROGRESS: "Design In Progress",
  READY_FOR_DEV: "Ready for Development",
  DEV_IN_PROGRESS: "Development In Progress",
  READY_FOR_TESTING: "Ready for Testing",
  TESTING_IN_PROGRESS: "Testing In Progress",
  CHANGES_REQUIRED: "Changes Required",
  READY_FOR_RELEASE: "Ready for Release",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export const LIFECYCLE_COLOR: Record<PageLifecycle, string> = {
  NOT_STARTED: "#9AA1AE",
  DESIGN_IN_PROGRESS: "#EC6A52",
  READY_FOR_DEV: "#F59E0B",
  DEV_IN_PROGRESS: "#5B5FEF",
  READY_FOR_TESTING: "#0EA5E9",
  TESTING_IN_PROGRESS: "#1EAE7C",
  CHANGES_REQUIRED: "#F59E0B",
  READY_FOR_RELEASE: "#A855F7",
  COMPLETED: "#16A34A",
  BLOCKED: "#D1495B",
};

export const TEST_RESULT_LABEL: Record<TestResult, string> = {
  NOT_RUN: "Not Run",
  PASS: "Pass",
  FAIL: "Fail",
  BLOCKED: "Blocked",
};

export const TEST_RESULT_COLOR: Record<TestResult, string> = {
  NOT_RUN: "#9AA1AE",
  PASS: "#1EAE7C",
  FAIL: "#D1495B",
  BLOCKED: "#F59E0B",
};

export const BUG_STATUS_LABEL: Record<BugStatus, string> = {
  OPEN: "Open",
  TRIAGED: "Triaged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  READY_FOR_RETEST: "Ready for Retest",
  RETEST_FAILED: "Retest Failed",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  WONT_FIX: "Won't Fix",
  DUPLICATE: "Duplicate",
};

/** Bug statuses that no longer need work. */
export const BUG_RESOLVED: BugStatus[] = ["VERIFIED", "CLOSED", "WONT_FIX", "DUPLICATE"];

export const SEVERITY_COLOR: Record<BugSeverity, string> = {
  LOW: "#9AA1AE",
  MEDIUM: "#F59E0B",
  HIGH: "#EC6A52",
  CRITICAL: "#D1495B",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "#9AA1AE",
  MEDIUM: "#3B82F6",
  HIGH: "#F59E0B",
  URGENT: "#D1495B",
};

// ── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceType =
  | "FIGMA"
  | "SCREENSHOT"
  | "RECORDING"
  | "PR"
  | "COMMIT"
  | "BUILD"
  | "DOC"
  | "OTHER";

export interface EvidenceEntry {
  type: EvidenceType;
  url: string;
  label?: string;
}

export const EVIDENCE_TYPES: EvidenceType[] = [
  "FIGMA",
  "SCREENSHOT",
  "RECORDING",
  "PR",
  "COMMIT",
  "BUILD",
  "DOC",
  "OTHER",
];

export const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  FIGMA: "Figma",
  SCREENSHOT: "Screenshot",
  RECORDING: "Recording",
  PR: "Pull request",
  COMMIT: "Commit",
  BUILD: "Build / deployment",
  DOC: "Document",
  OTHER: "Other",
};

/**
 * Which evidence satisfies a workstream. A submission needs at least ONE entry
 * whose type is in the list (a PR link beats a screenshot for development; a
 * Figma link beats a screenshot for design). Testing proof is the executed test
 * cases themselves, so no extra link is required.
 */
export const REQUIRED_EVIDENCE: Record<Workstream, EvidenceType[]> = {
  DESIGN: ["FIGMA", "SCREENSHOT", "RECORDING", "DOC"],
  DEVELOPMENT: ["PR", "COMMIT", "BUILD"],
  TESTING: [],
};

export const ACTION = {
  PAGE_CREATED: "PAGE_CREATED",
  PAGE_UPDATED: "PAGE_UPDATED",
  PAGE_ARCHIVED: "PAGE_ARCHIVED",
  PAGE_RESTORED: "PAGE_RESTORED",
  PAGE_RELEASED: "PAGE_RELEASED",
  ITEM_CREATED: "ITEM_CREATED",
  ITEM_UPDATED: "ITEM_UPDATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  DUE_DATE_CHANGED: "DUE_DATE_CHANGED",
  ASSIGNEE_CHANGED: "ASSIGNEE_CHANGED",
  REVIEWER_CHANGED: "REVIEWER_CHANGED",
  OWNERSHIP_ACKNOWLEDGED: "OWNERSHIP_ACKNOWLEDGED",
  EVIDENCE_CHANGED: "EVIDENCE_CHANGED",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  COMMENTED: "COMMENTED",
  PLANNING_CHANGED: "PLANNING_CHANGED",
  ITEM_CANCELLED: "ITEM_CANCELLED",
  ITEM_ARCHIVED: "ITEM_ARCHIVED",
  ITEM_RESTORED: "ITEM_RESTORED",
  ADMIN_OVERRIDE: "ADMIN_OVERRIDE",
  TEST_CASE_ADDED: "TEST_CASE_ADDED",
  TEST_CASE_UPDATED: "TEST_CASE_UPDATED",
  TEST_CASE_REMOVED: "TEST_CASE_REMOVED",
  TEST_RESULT_RECORDED: "TEST_RESULT_RECORDED",
  BUG_CREATED: "BUG_CREATED",
  BUG_UPDATED: "BUG_UPDATED",
  BUG_STATUS_CHANGED: "BUG_STATUS_CHANGED",
} as const;
export type AuditAction = (typeof ACTION)[keyof typeof ACTION];

export const ACTION_LABEL: Record<string, string> = {
  PAGE_CREATED: "created the page",
  PAGE_UPDATED: "updated the page",
  PAGE_ARCHIVED: "archived the page",
  PAGE_RESTORED: "restored the page",
  PAGE_RELEASED: "approved the release",
  ITEM_CREATED: "created a work item",
  ITEM_UPDATED: "updated a work item",
  STATUS_CHANGED: "changed status",
  DUE_DATE_CHANGED: "changed the due date",
  ASSIGNEE_CHANGED: "reassigned a work item",
  REVIEWER_CHANGED: "changed the reviewer",
  OWNERSHIP_ACKNOWLEDGED: "acknowledged ownership",
  EVIDENCE_CHANGED: "changed evidence",
  SUBMITTED: "submitted for review",
  APPROVED: "approved a submission",
  CHANGES_REQUESTED: "requested changes",
  COMMENTED: "commented",
  PLANNING_CHANGED: "changed planning fields",
  ITEM_CANCELLED: "cancelled a work item",
  ITEM_ARCHIVED: "archived a work item",
  ITEM_RESTORED: "restored a work item",
  ADMIN_OVERRIDE: "used an administrative override",
  TEST_CASE_ADDED: "added a test case",
  TEST_CASE_UPDATED: "updated a test case",
  TEST_CASE_REMOVED: "removed a test case",
  TEST_RESULT_RECORDED: "recorded a test result",
  BUG_CREATED: "reported a bug",
  BUG_UPDATED: "updated a bug",
  BUG_STATUS_CHANGED: "changed a bug status",
};

export const NOTIFICATION_TYPES = [
  "WORK_ASSIGNED",
  "WORK_REASSIGNED",
  "REVIEW_REQUESTED",
  "REVIEW_APPROVED",
  "REVIEW_CHANGES",
  "WORK_BLOCKED",
  "BUG_ASSIGNED",
  "BUG_RETEST",
  "BUG_RETEST_RESULT",
  "TRACKER_COMMENT",
] as const;
