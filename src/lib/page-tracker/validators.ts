import { z } from "zod";
import { EVIDENCE_TYPES } from "./constants";
import { isSafeHttpUrl } from "./policy";

const id = z.string().cuid();
const optText = (max: number) => z.string().trim().max(max).optional().nullable();
const isoDate = z.string().datetime().optional().nullable();

const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeHttpUrl, "Must be a valid http(s) link");

export const linkSchema = z.object({
  label: z.string().trim().max(80).default(""),
  url: safeUrl,
});

export const evidenceSchema = z.object({
  type: z.enum(EVIDENCE_TYPES as [string, ...string[]]),
  url: safeUrl,
  label: z.string().trim().max(120).optional(),
});

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const workstream = z.enum(["DESIGN", "DEVELOPMENT", "TESTING"]);

// ── Pages ──────────────────────────────────────────────────────────────────
export const createPageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: optText(2000),
  type: z.enum(["PAGE", "MODULE"]).default("PAGE"),
  priority: priority.default("MEDIUM"),
  ownerId: id.optional().nullable(),
  targetDate: isoDate,
  links: z.array(linkSchema).max(15).optional(),
  designRequired: z.boolean().default(true),
  developmentRequired: z.boolean().default(true),
  testingRequired: z.boolean().default(true),
  requireFinalApproval: z.boolean().default(false),
  membersCanCreate: z.boolean().default(false),
});

export const updatePageSchema = z.object({
  pageId: id,
  changes: createPageSchema.partial().strict(),
});

// ── Work items ─────────────────────────────────────────────────────────────
export const createWorkItemSchema = z.object({
  pageId: id,
  workstream,
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optText(5000),
  acceptanceCriteria: optText(3000),
  priority: priority.default("MEDIUM"),
  assigneeId: id,
  reviewerId: id.optional().nullable(),
  requiresReview: z.boolean().default(true),
  dueDate: isoDate,
  links: z.array(linkSchema).max(15).optional(),
  boardId: id.optional().nullable(),
});

/** Explicit allowlist of owner-editable fields (mass-assignment guard). */
export const ownerChangesSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200).optional(),
    description: optText(5000),
    acceptanceCriteria: optText(3000),
    notes: optText(5000),
    dueDate: isoDate,
    links: z.array(linkSchema).max(15).optional(),
    evidence: z.array(evidenceSchema).max(30).optional(),
  })
  .strict();

export const updateWorkItemSchema = z.object({
  workItemId: id,
  expectedVersion: z.number().int().min(1),
  changes: ownerChangesSchema,
});

export const statusChangeSchema = z.object({
  workItemId: id,
  expectedVersion: z.number().int().min(1),
  to: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "DONE", "CANCELLED"]),
  reason: optText(500),
});

export const submitSchema = z.object({
  workItemId: id,
  expectedVersion: z.number().int().min(1),
  summary: z.string().trim().min(1, "Add a short summary").max(3000),
});

export const reassignSchema = z.object({
  workItemId: id,
  newAssigneeId: id,
  reason: z.string().trim().min(3, "A reason is required").max(500),
});

export const changeReviewerSchema = z.object({
  workItemId: id,
  reviewerId: id,
  reason: z.string().trim().min(3, "A reason is required").max(500),
});

export const planningSchema = z.object({
  workItemId: id,
  changes: z
    .object({
      priority: priority.optional(),
      dueDate: isoDate,
      isRequired: z.boolean().optional(),
      exclusionReason: optText(500),
    })
    .strict(),
});

export const overrideSchema = z.object({
  workItemId: id,
  reason: z.string().trim().min(5, "Explain why you are overriding").max(500),
  changes: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: optText(5000),
      acceptanceCriteria: optText(3000),
      notes: optText(5000),
      dueDate: isoDate,
      priority: priority.optional(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED"]).optional(),
      blockedReason: optText(500),
    })
    .strict(),
});

export const commentSchema = z.object({
  workItemId: id,
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

// ── Reviews ────────────────────────────────────────────────────────────────
export const approveSchema = z.object({
  submissionId: id,
  comment: optText(2000),
  exceptionReason: optText(500),
});
export const requestChangesSchema = z.object({
  submissionId: id,
  comment: z.string().trim().min(3, "A comment is required").max(2000),
});

// ── Testing & bugs ─────────────────────────────────────────────────────────
export const testCaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  preconditions: optText(2000),
  steps: optText(4000),
  expected: optText(2000),
  isMandatory: z.boolean().default(true),
});
export const addTestCaseSchema = z.object({ workItemId: id, testCase: testCaseSchema });
export const updateTestCaseSchema = z.object({
  testCaseId: id,
  changes: testCaseSchema.partial().strict(),
});
export const recordResultSchema = z.object({
  testCaseId: id,
  result: z.enum(["NOT_RUN", "PASS", "FAIL", "BLOCKED"]),
  actual: optText(4000),
  environment: optText(200),
  buildVersion: optText(100),
  evidenceUrl: z.string().trim().max(2000).refine((v) => !v || isSafeHttpUrl(v), "Must be a valid http(s) link").optional().nullable(),
});

const severity = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const createBugSchema = z.object({
  pageId: id,
  testCaseId: id.optional().nullable(),
  testWorkItemId: id.optional().nullable(),
  devWorkItemId: id.optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optText(4000),
  stepsToReproduce: optText(4000),
  expectedResult: optText(2000),
  actualResult: optText(2000),
  severity: severity.default("MEDIUM"),
  priority: priority.default("MEDIUM"),
  assigneeId: id.optional().nullable(),
  environment: optText(200),
  buildVersion: optText(100),
  evidenceUrl: z.string().trim().max(2000).refine((v) => !v || isSafeHttpUrl(v), "Must be a valid http(s) link").optional().nullable(),
});
export const triageBugSchema = z.object({
  bugId: id,
  changes: z
    .object({
      assigneeId: id.nullable().optional(),
      devWorkItemId: id.nullable().optional(),
      severity: severity.optional(),
      priority: priority.optional(),
      releaseBlocking: z.boolean().optional(),
      status: z.enum(["OPEN", "TRIAGED", "CLOSED", "WONT_FIX", "DUPLICATE"]).optional(),
    })
    .strict(),
});
export const bugNoteSchema = z.object({ bugId: id, note: optText(2000) });
export const retestSchema = z.object({
  bugId: id,
  passed: z.boolean(),
  note: optText(2000),
});
