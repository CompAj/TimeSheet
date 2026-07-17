import "server-only"

import { assertCanAccessTimesheet, displayName, type AppUser } from "@/lib/auth"
import {
  addDaysUTC,
  buildWeekDates,
  endOfPayPeriodUTC,
  endOfWeekUTC,
  formatPayPeriodRange,
  formatWeekRange,
  resolvePayPeriodStart,
  toISODate,
} from "@/lib/dates"
import { requirePayrollAnchor } from "@/lib/payroll"
import { canApproveTimesheet, canEditTimesheet } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  calculateDay,
  calculatePayPeriod,
  calculateWeek,
  type CalculatedPayPeriod,
  type TimesheetDayInput,
  type TimesheetStatusValue,
} from "@/lib/timesheet-calculations"

export type OverviewWeek = {
  id: string | null
  weekStartDate: string
  weekLabel: string
  status: TimesheetStatusValue
  completionPercentage: number
  completedDays: number
  canEdit: boolean
  canManage: boolean
}

export type OverviewRow = {
  userId: string
  employeeName: string
  email: string | null
  role: string
  managerName: string | null
  status: TimesheetStatusValue
  completionPercentage: number
  completedDays: number
  totalWorkedHours: number
  totalBreakMinutes: number
  regularHours: number
  holidayOvertimeHours: number
  thresholdOvertimeHours: number
  overtimeHours: number
  lastEdited: string
  canEdit: boolean
  canManage: boolean
  weeks: OverviewWeek[]
}

export type TimesheetEditorDay = {
  id: string
  date: string
  dayOfWeek: string
  startTime: string
  endTime: string
  breakMinutes: number
  notes: string
  isDayOff: boolean
  isHoliday: boolean
  holidayOverride: boolean | null
  holidayName: string | null
  workedHours: number
  status: string
}

export type TimesheetEditorWeek = {
  id: string
  weekStartDate: string
  weekEndDate: string
  weekLabel: string
  status: TimesheetStatusValue
  completionPercentage: number
  completedDays: number
  totalWorkedHours: number
  totalBreakMinutes: number
  regularHours: number
  overtimeHours: number
  submittedAt: string | null
  approvedAt: string | null
  canEdit: boolean
  canManage: boolean
  days: TimesheetEditorDay[]
}

export type TimesheetEditorData = {
  userId: string
  employeeName: string
  email: string | null
  role: string
  periodStartDate: string
  periodEndDate: string
  periodLabel: string
  totalWorkedHours: number
  totalBreakMinutes: number
  regularHours: number
  holidayOvertimeHours: number
  thresholdOvertimeHours: number
  overtimeHours: number
  completedDays: number
  completionPercentage: number
  weeks: TimesheetEditorWeek[]
}

export async function getTimesheetOverview(periodStart: Date, currentUser: AppUser): Promise<OverviewRow[]> {
  const weekStarts = [periodStart, addDaysUTC(periodStart, 7)]
  const users = await prisma.user.findMany({
    where: { role: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    include: {
      manager: true,
      weeklySheets: {
        where: { weekStartDate: { in: weekStarts } },
        include: { days: { orderBy: { date: "asc" } } },
        orderBy: { weekStartDate: "asc" },
      },
    },
  })

  const visibleUsers = currentUser.hideSelfFromTimesheetOverview
    ? users.filter((user) => user.id !== currentUser.id)
    : users

  return visibleUsers.map((user) => {
    const sheets = weekStarts.map((weekStart) =>
      user.weeklySheets.find((sheet) => toISODate(sheet.weekStartDate) === toISODate(weekStart)),
    )
    const period = calculatePayPeriod(
      sheets.map((sheet, index) => ({
        days: sheet ? sheet.days.map(databaseDayToInput) : buildEmptyWeekInputs(weekStarts[index]),
        currentStatus: (sheet?.status ?? "NOT_STARTED") as TimesheetStatusValue,
      })),
      { safe: true },
    )
    const statuses = sheets.map((sheet) => (sheet?.status ?? "NOT_STARTED") as TimesheetStatusValue)
    const latestUpdate = sheets.reduce<Date | null>(
      (latest, sheet) => (!sheet ? latest : !latest || sheet.updatedAt > latest ? sheet.updatedAt : latest),
      null,
    )

    const baseCanManage = canApproveTimesheet(currentUser, user)
    const weeks = weekStarts.map((weekStart, index) => {
      const sheet = sheets[index]
      const status = statuses[index]
      const summary = period.weeks[index]
      return {
        id: sheet?.id ?? null,
        weekStartDate: toISODate(weekStart),
        weekLabel: formatWeekRange(weekStart),
        status,
        completionPercentage: summary.completionPercentage,
        completedDays: summary.completedDays,
        canEdit: canEditTimesheet(currentUser, user, status),
        canManage: baseCanManage,
      }
    })

    return {
      userId: user.id,
      employeeName: displayName(user),
      email: user.email,
      role: user.role,
      managerName: user.manager ? displayName(user.manager) : null,
      status: combinedStatus(statuses),
      completionPercentage: period.completionPercentage,
      completedDays: period.completedDays,
      totalWorkedHours: period.totalWorkedHours,
      totalBreakMinutes: period.totalBreakMinutes,
      regularHours: period.regularHours,
      holidayOvertimeHours: period.holidayOvertimeHours,
      thresholdOvertimeHours: period.thresholdOvertimeHours,
      overtimeHours: period.overtimeHours,
      lastEdited: latestUpdate ? formatRelative(latestUpdate) : "Not yet",
      canEdit: weeks.some((week) => week.canEdit),
      canManage: baseCanManage,
      weeks,
    }
  })
}

export async function getAllTimeWorkedHours(currentUser: AppUser) {
  const result = await prisma.weeklyTimesheet.aggregate({
    where: {
      user: {
        role: { in: ["EMPLOYEE", "MANAGER"] },
        ...(currentUser.hideSelfFromTimesheetOverview
          ? { id: { not: currentUser.id } }
          : {}),
      },
    },
    _sum: {
      totalWorkedHours: true,
    },
  })

  const total = result._sum.totalWorkedHours ?? 0
  return Math.round(total * 100) / 100
}

export async function getTimesheetForEditor(
  currentUser: AppUser,
  targetUserId: string,
  selectedPeriodStart: Date,
): Promise<TimesheetEditorData> {
  await assertCanAccessTimesheet(currentUser, targetUserId)
  const anchor = await requirePayrollAnchor()
  const periodStart = resolvePayPeriodStart(selectedPeriodStart, anchor)
  const user = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!user) throw new Error("Employee not found.")

  const weekStarts = [periodStart, addDaysUTC(periodStart, 7)]
  const sheets = []
  for (const weekStart of weekStarts) {
    sheets.push(await getOrCreateWeeklyTimesheet(targetUserId, weekStart))
  }

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: periodStart, lte: endOfPayPeriodUTC(periodStart) } },
  })
  const holidayNames = new Map(holidays.map((holiday) => [toISODate(holiday.date), holiday.name]))
  const period = calculatePayPeriod(
    sheets.map((sheet) => ({
      days: sheet.days.map(databaseDayToInput),
      currentStatus: sheet.status as TimesheetStatusValue,
    })),
    { safe: true },
  )

  const weeks = sheets.map((sheet, index): TimesheetEditorWeek => {
    const status = sheet.status as TimesheetStatusValue
    const calculated = period.weeks[index]
    return {
      id: sheet.id,
      weekStartDate: toISODate(sheet.weekStartDate),
      weekEndDate: toISODate(sheet.weekEndDate),
      weekLabel: formatWeekRange(sheet.weekStartDate),
      status,
      completionPercentage: calculated.completionPercentage,
      completedDays: calculated.completedDays,
      totalWorkedHours: calculated.totalWorkedHours,
      totalBreakMinutes: calculated.totalBreakMinutes,
      regularHours: calculated.regularHours,
      overtimeHours: calculated.overtimeHours,
      submittedAt: sheet.submittedAt?.toISOString() ?? null,
      approvedAt: sheet.approvedAt?.toISOString() ?? null,
      canEdit: canEditTimesheet(currentUser, user, status),
      canManage: canApproveTimesheet(currentUser, user),
      days: sheet.days.map((day) => ({
        id: day.id,
        date: toISODate(day.date),
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime ?? "",
        endTime: day.endTime ?? "",
        breakMinutes: day.breakMinutes,
        notes: day.notes ?? "",
        isDayOff: day.isDayOff,
        isHoliday: day.isHoliday,
        holidayOverride: day.holidayOverride,
        holidayName: holidayNames.get(toISODate(day.date)) ?? null,
        workedHours: day.workedHours,
        status: day.status,
      })),
    }
  })

  return {
    userId: user.id,
    employeeName: displayName(user),
    email: user.email,
    role: user.role,
    periodStartDate: toISODate(periodStart),
    periodEndDate: toISODate(endOfPayPeriodUTC(periodStart)),
    periodLabel: formatPayPeriodRange(periodStart),
    totalWorkedHours: period.totalWorkedHours,
    totalBreakMinutes: period.totalBreakMinutes,
    regularHours: period.regularHours,
    holidayOvertimeHours: period.holidayOvertimeHours,
    thresholdOvertimeHours: period.thresholdOvertimeHours,
    overtimeHours: period.overtimeHours,
    completedDays: period.completedDays,
    completionPercentage: period.completionPercentage,
    weeks,
  }
}

export async function getOrCreateWeeklyTimesheet(userId: string, weekStart: Date) {
  const existing = await prisma.weeklyTimesheet.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate: weekStart } },
    include: { days: { orderBy: { date: "asc" } } },
  })
  const weekEnd = endOfWeekUTC(weekStart)
  const holidays = await prisma.holiday.findMany({ where: { date: { gte: weekStart, lte: weekEnd } } })
  const holidayDates = new Set(holidays.map((holiday) => toISODate(holiday.date)))
  const expectedDays = buildWeekDates(weekStart)
  const existingDates = new Set(existing?.days.map((day) => toISODate(day.date)) ?? [])
  const days = expectedDays.filter(({ date }) => !existingDates.has(toISODate(date))).map(({ date, dayName }) => ({
    date,
    dayOfWeek: dayName,
    breakMinutes: 0,
    notes: null,
    isDayOff: false,
    isHoliday: holidayDates.has(toISODate(date)),
    holidayOverride: null,
    workedHours: 0,
    status: holidayDates.has(toISODate(date)) ? ("HOLIDAY" as const) : ("EMPTY" as const),
  }))

  if (existing) {
    if (days.length === 0) return existing
    return prisma.weeklyTimesheet.update({
      where: { id: existing.id },
      data: { weekEndDate: weekEnd, days: { create: days } },
      include: { days: { orderBy: { date: "asc" } } },
    })
  }

  return prisma.weeklyTimesheet.create({
    data: {
      userId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: days.some((day) => day.status === "HOLIDAY") ? "DRAFT" : "NOT_STARTED",
      completionPercentage: Math.round((days.filter((day) => day.status === "HOLIDAY").length / 7) * 100),
      days: { create: days },
    },
    include: { days: { orderBy: { date: "asc" } } },
  })
}

export function normalizeDayInput(day: TimesheetEditorDay): TimesheetDayInput & { holidayOverride: boolean | null } {
  return {
    id: day.id,
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    startTime: day.isDayOff ? null : day.startTime || null,
    endTime: day.isDayOff ? null : day.endTime || null,
    breakMinutes: day.isDayOff ? 0 : Number(day.breakMinutes) || 0,
    notes: day.notes,
    isDayOff: day.isDayOff,
    isHoliday: day.isDayOff ? false : day.isHoliday,
    holidayOverride: day.isDayOff ? false : day.holidayOverride,
  }
}

export function calculateRows(days: Array<TimesheetDayInput & { holidayOverride?: boolean | null }>) {
  return days.map((day) => {
    const calculated = calculateDay(day)
    return {
      date: new Date(`${day.date}T00:00:00.000Z`),
      dayOfWeek: day.dayOfWeek,
      startTime: day.isDayOff ? null : day.startTime || null,
      endTime: day.isDayOff ? null : day.endTime || null,
      breakMinutes: day.isDayOff ? 0 : day.breakMinutes,
      notes: day.notes?.trim() || null,
      isDayOff: day.isDayOff,
      isHoliday: Boolean(day.isHoliday) && !day.isDayOff,
      holidayOverride: day.holidayOverride ?? null,
      workedHours: calculated.workedHours,
      status: calculated.status,
    }
  })
}

export function calculateTotals(days: TimesheetDayInput[], currentStatus?: TimesheetStatusValue) {
  return calculateWeek(days, currentStatus)
}

export function calculatePeriodTotals(
  weeks: Array<{ days: TimesheetDayInput[]; currentStatus?: TimesheetStatusValue }>,
): CalculatedPayPeriod {
  return calculatePayPeriod(weeks)
}

export function databaseDayToInput(day: {
  id: string
  date: Date
  dayOfWeek: string
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  notes: string | null
  isDayOff: boolean
  isHoliday: boolean
}): TimesheetDayInput {
  return {
    id: day.id,
    date: toISODate(day.date),
    dayOfWeek: day.dayOfWeek,
    startTime: day.startTime,
    endTime: day.endTime,
    breakMinutes: day.breakMinutes,
    notes: day.notes,
    isDayOff: day.isDayOff,
    isHoliday: day.isHoliday,
  }
}

function buildEmptyWeekInputs(weekStart: Date): TimesheetDayInput[] {
  return buildWeekDates(weekStart).map(({ date, dayName }) => ({
    date: toISODate(date),
    dayOfWeek: dayName,
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    notes: null,
    isDayOff: false,
    isHoliday: false,
  }))
}

function combinedStatus(statuses: TimesheetStatusValue[]): TimesheetStatusValue {
  if (statuses.includes("NEEDS_REVIEW")) return "NEEDS_REVIEW"
  if (statuses.every((status) => status === "APPROVED")) return "APPROVED"
  if (statuses.every((status) => status === "SUBMITTED" || status === "APPROVED")) return "SUBMITTED"
  if (statuses.every((status) => ["READY_TO_SUBMIT", "SUBMITTED", "APPROVED"].includes(status))) {
    return "READY_TO_SUBMIT"
  }
  if (statuses.every((status) => status === "NOT_STARTED")) return "NOT_STARTED"
  if (statuses.includes("IN_PROGRESS")) return "IN_PROGRESS"
  return "DRAFT"
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return "Just now"
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 14) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
