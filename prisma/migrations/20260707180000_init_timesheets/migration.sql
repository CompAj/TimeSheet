-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'APPROVED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "TimesheetDayStatus" AS ENUM ('EMPTY', 'INCOMPLETE', 'COMPLETE', 'DAY_OFF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "invitedById" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTimesheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "totalWorkedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetDay" (
    "id" TEXT NOT NULL,
    "weeklyTimesheetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "workedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TimesheetDayStatus" NOT NULL DEFAULT 'EMPTY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTimesheet_userId_weekStartDate_key" ON "WeeklyTimesheet"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyTimesheet_weekStartDate_idx" ON "WeeklyTimesheet"("weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyTimesheet_status_idx" ON "WeeklyTimesheet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetDay_weeklyTimesheetId_date_key" ON "TimesheetDay"("weeklyTimesheetId", "date");

-- CreateIndex
CREATE INDEX "TimesheetDay_date_idx" ON "TimesheetDay"("date");

-- CreateIndex
CREATE INDEX "TimesheetDay_status_idx" ON "TimesheetDay"("status");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTimesheet" ADD CONSTRAINT "WeeklyTimesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetDay" ADD CONSTRAINT "TimesheetDay_weeklyTimesheetId_fkey" FOREIGN KEY ("weeklyTimesheetId") REFERENCES "WeeklyTimesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
