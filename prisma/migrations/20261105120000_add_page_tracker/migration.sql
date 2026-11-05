-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('PAGE', 'MODULE');

-- CreateEnum
CREATE TYPE "Workstream" AS ENUM ('DESIGN', 'DEVELOPMENT', 'TESTING');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('NOT_RUN', 'PASS', 'FAIL', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'READY_FOR_RETEST', 'RETEST_FAILED', 'VERIFIED', 'CLOSED', 'WONT_FIX', 'DUPLICATE');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "link" TEXT;

-- CreateTable
CREATE TABLE "TrackerPage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PageType" NOT NULL DEFAULT 'PAGE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" TEXT,
    "targetDate" TIMESTAMP(3),
    "links" JSONB,
    "designRequired" BOOLEAN NOT NULL DEFAULT true,
    "developmentRequired" BOOLEAN NOT NULL DEFAULT true,
    "testingRequired" BOOLEAN NOT NULL DEFAULT true,
    "requireFinalApproval" BOOLEAN NOT NULL DEFAULT false,
    "membersCanCreate" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "TrackerPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "workstream" "Workstream" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "notes" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "exclusionReason" TEXT,
    "blockedReason" TEXT,
    "cancelledReason" TEXT,
    "links" JSONB,
    "evidence" JSONB,
    "ownerAcknowledged" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "currentSubmissionId" TEXT,
    "ticketId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemSubmission" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "submissionNumber" INTEGER NOT NULL,
    "submittedById" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "testResults" JSONB,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemReview" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "exceptionReason" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemComment" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "preconditions" TEXT,
    "steps" TEXT,
    "expected" TEXT,
    "actual" TEXT,
    "result" "TestResult" NOT NULL DEFAULT 'NOT_RUN',
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT,
    "buildVersion" TEXT,
    "evidenceUrl" TEXT,
    "testedById" TEXT,
    "testedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerBug" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "testWorkItemId" TEXT,
    "testCaseId" TEXT,
    "devWorkItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stepsToReproduce" TEXT,
    "expectedResult" TEXT,
    "actualResult" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" TEXT,
    "reporterId" TEXT NOT NULL,
    "environment" TEXT,
    "buildVersion" TEXT,
    "evidenceUrl" TEXT,
    "releaseBlocking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "TrackerBug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackerAudit" (
    "id" TEXT NOT NULL,
    "pageId" TEXT,
    "workItemId" TEXT,
    "bugId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackerPage_projectId_archivedAt_idx" ON "TrackerPage"("projectId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_ticketId_key" ON "WorkItem"("ticketId");

-- CreateIndex
CREATE INDEX "WorkItem_pageId_workstream_status_idx" ON "WorkItem"("pageId", "workstream", "status");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_dueDate_idx" ON "WorkItem"("assigneeId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "WorkItem_reviewerId_status_idx" ON "WorkItem"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "WorkItemSubmission_workItemId_idx" ON "WorkItemSubmission"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemSubmission_workItemId_submissionNumber_key" ON "WorkItemSubmission"("workItemId", "submissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemReview_submissionId_key" ON "WorkItemReview"("submissionId");

-- CreateIndex
CREATE INDEX "WorkItemReview_workItemId_idx" ON "WorkItemReview"("workItemId");

-- CreateIndex
CREATE INDEX "WorkItemReview_reviewerId_reviewedAt_idx" ON "WorkItemReview"("reviewerId", "reviewedAt");

-- CreateIndex
CREATE INDEX "WorkItemComment_workItemId_createdAt_idx" ON "WorkItemComment"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "TestCase_workItemId_idx" ON "TestCase"("workItemId");

-- CreateIndex
CREATE INDEX "TrackerBug_pageId_status_severity_idx" ON "TrackerBug"("pageId", "status", "severity");

-- CreateIndex
CREATE INDEX "TrackerBug_assigneeId_status_idx" ON "TrackerBug"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "TrackerAudit_pageId_createdAt_idx" ON "TrackerAudit"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "TrackerAudit_workItemId_createdAt_idx" ON "TrackerAudit"("workItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrackerPage" ADD CONSTRAINT "TrackerPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerPage" ADD CONSTRAINT "TrackerPage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerPage" ADD CONSTRAINT "TrackerPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TrackerPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemSubmission" ADD CONSTRAINT "WorkItemSubmission_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemSubmission" ADD CONSTRAINT "WorkItemSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReview" ADD CONSTRAINT "WorkItemReview_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReview" ADD CONSTRAINT "WorkItemReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WorkItemSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemReview" ADD CONSTRAINT "WorkItemReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemComment" ADD CONSTRAINT "WorkItemComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TrackerPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_testWorkItemId_fkey" FOREIGN KEY ("testWorkItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_devWorkItemId_fkey" FOREIGN KEY ("devWorkItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerBug" ADD CONSTRAINT "TrackerBug_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerAudit" ADD CONSTRAINT "TrackerAudit_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TrackerPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerAudit" ADD CONSTRAINT "TrackerAudit_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackerAudit" ADD CONSTRAINT "TrackerAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

