-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingSync" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MonthlyMode" AS ENUM ('DAY_OF_MONTH', 'NTH_WEEKDAY');

-- CreateEnum
CREATE TYPE "RecurrenceEnd" AS ENUM ('NEVER', 'ON_DATE', 'AFTER_COUNT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('CANCELLED', 'MODIFIED');

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL DEFAULT 'workspace',
    "email" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "calendarName" TEXT,
    "refreshTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberEmail" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberEmail_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "MeetingKind" NOT NULL DEFAULT 'ONE_TIME',
    "status" "MeetingStatus" NOT NULL DEFAULT 'ACTIVE',
    "startLocal" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "startUtc" TIMESTAMP(3) NOT NULL,
    "freq" "RecurrenceFreq",
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" TEXT[],
    "monthlyMode" "MonthlyMode",
    "endType" "RecurrenceEnd" NOT NULL DEFAULT 'NEVER',
    "untilDate" TEXT,
    "occurrenceCount" INTEGER,
    "rrule" TEXT,
    "addMeet" BOOLEAN NOT NULL DEFAULT true,
    "sendInvites" BOOLEAN NOT NULL DEFAULT true,
    "guestsCanModify" BOOLEAN NOT NULL DEFAULT false,
    "guestsCanInvite" BOOLEAN NOT NULL DEFAULT false,
    "guestsCanSeeOthers" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutes" INTEGER,
    "googleEventId" TEXT,
    "calendarId" TEXT,
    "meetUrl" TEXT,
    "htmlLink" TEXT,
    "syncStatus" "MeetingSync" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingException" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "originalStartLocal" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "newStartLocal" TEXT,
    "newDurationMin" INTEGER,
    "googleInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberEmail_email_idx" ON "MemberEmail"("email");

-- CreateIndex
CREATE INDEX "Meeting_projectId_status_startUtc_idx" ON "Meeting"("projectId", "status", "startUtc");

-- CreateIndex
CREATE INDEX "Meeting_googleEventId_idx" ON "Meeting"("googleEventId");

-- CreateIndex
CREATE INDEX "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendee_meetingId_email_key" ON "MeetingAttendee"("meetingId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingException_meetingId_originalStartLocal_key" ON "MeetingException"("meetingId", "originalStartLocal");

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberEmail" ADD CONSTRAINT "MemberEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingException" ADD CONSTRAINT "MeetingException_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

