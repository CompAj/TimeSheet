-- Add holiday-aware day status.
ALTER TYPE "TimesheetDayStatus" ADD VALUE IF NOT EXISTS 'HOLIDAY';

-- Workspace payroll configuration is intentionally a singleton. The anchor is
-- populated by a manager after deployment so existing installations can choose
-- their real payroll boundary.
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL DEFAULT 'workspace',
    "payPeriodAnchorDate" DATE,
    "payrollConfiguredAt" TIMESTAMP(3),
    "payrollConfiguredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

ALTER TABLE "TimesheetDay"
  ADD COLUMN "isHoliday" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "holidayOverride" BOOLEAN;

-- Existing sheets were Monday-Sunday. Re-bucket every day into its containing
-- Sunday-Saturday week. Temporary tables retain source status so a new week is
-- only kept locked when every source sheet contributing days was locked.
CREATE TEMP TABLE "_rebucket_days" AS
SELECT
  d.*,
  w."userId" AS "sourceUserId",
  w."status" AS "sourceStatus",
  w."submittedAt" AS "sourceSubmittedAt",
  w."approvedAt" AS "sourceApprovedAt",
  (d."date" - EXTRACT(DOW FROM d."date")::integer) AS "newWeekStart"
FROM "TimesheetDay" d
JOIN "WeeklyTimesheet" w ON w."id" = d."weeklyTimesheetId";

-- Day rows will be restored after rebuilding week containers.
DELETE FROM "TimesheetDay";
DELETE FROM "WeeklyTimesheet";

INSERT INTO "WeeklyTimesheet" (
  "id", "userId", "weekStartDate", "weekEndDate", "status",
  "completionPercentage", "totalWorkedHours", "totalBreakMinutes",
  "regularHours", "overtimeHours", "submittedAt", "approvedAt",
  "createdAt", "updatedAt"
)
SELECT
  md5("sourceUserId" || ':' || "newWeekStart"::text),
  "sourceUserId",
  "newWeekStart",
  "newWeekStart" + 6,
  CASE
    WHEN bool_or("sourceStatus" = 'NEEDS_REVIEW') THEN 'NEEDS_REVIEW'::"TimesheetStatus"
    WHEN count(*) = 7 AND bool_and("sourceStatus" = 'APPROVED') THEN 'APPROVED'::"TimesheetStatus"
    WHEN count(*) = 7 AND bool_and("sourceStatus" IN ('SUBMITTED', 'APPROVED')) THEN 'SUBMITTED'::"TimesheetStatus"
    ELSE 'DRAFT'::"TimesheetStatus"
  END,
  0, 0, 0, 0, 0,
  CASE WHEN count(*) = 7 AND bool_and("sourceStatus" IN ('SUBMITTED', 'APPROVED')) THEN max("sourceSubmittedAt") END,
  CASE WHEN count(*) = 7 AND bool_and("sourceStatus" = 'APPROVED') THEN max("sourceApprovedAt") END,
  min("createdAt"), max("updatedAt")
FROM "_rebucket_days"
GROUP BY "sourceUserId", "newWeekStart";

INSERT INTO "TimesheetDay" (
  "id", "weeklyTimesheetId", "date", "dayOfWeek", "startTime", "endTime",
  "breakMinutes", "notes", "isDayOff", "isHoliday", "holidayOverride",
  "workedHours", "status", "createdAt", "updatedAt"
)
SELECT
  d."id",
  md5(d."sourceUserId" || ':' || d."newWeekStart"::text),
  d."date",
  trim(to_char(d."date", 'Day')),
  d."startTime", d."endTime", d."breakMinutes", d."notes", d."isDayOff",
  false, NULL, d."workedHours", d."status", d."createdAt", d."updatedAt"
FROM "_rebucket_days" d;

-- Recalculate migration-safe weekly completion and worked/break totals. Regular
-- and overtime are finalized after the payroll anchor is chosen.
UPDATE "WeeklyTimesheet" w
SET
  "completionPercentage" = stats."completionPercentage",
  "totalWorkedHours" = stats."totalWorkedHours",
  "totalBreakMinutes" = stats."totalBreakMinutes",
  "regularHours" = stats."totalWorkedHours",
  "overtimeHours" = 0,
  "status" = CASE
    WHEN w."status" IN ('APPROVED', 'SUBMITTED', 'NEEDS_REVIEW') THEN w."status"
    WHEN stats."completedDays" = 0 THEN 'NOT_STARTED'::"TimesheetStatus"
    WHEN stats."completedDays" = 7 THEN 'READY_TO_SUBMIT'::"TimesheetStatus"
    WHEN stats."incompleteDays" > 0 THEN 'IN_PROGRESS'::"TimesheetStatus"
    ELSE 'DRAFT'::"TimesheetStatus"
  END
FROM (
  SELECT
    "weeklyTimesheetId",
    round(count(*) FILTER (WHERE "status" IN ('COMPLETE', 'DAY_OFF')) * 100.0 / 7)::integer AS "completionPercentage",
    count(*) FILTER (WHERE "status" IN ('COMPLETE', 'DAY_OFF')) AS "completedDays",
    count(*) FILTER (WHERE "status" = 'INCOMPLETE') AS "incompleteDays",
    coalesce(sum("workedHours"), 0) AS "totalWorkedHours",
    coalesce(sum("breakMinutes") FILTER (WHERE "status" = 'COMPLETE'), 0)::integer AS "totalBreakMinutes"
  FROM "TimesheetDay"
  GROUP BY "weeklyTimesheetId"
) stats
WHERE w."id" = stats."weeklyTimesheetId";
