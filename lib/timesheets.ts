import "server-only"

import { assertCanAccessTimesheet, displayName, type AppUser } from "@/lib/auth"
import { buildWeekDates, endOfWeekUTC, formatWeekRange, toISODate } from "@/lib/dates"
import { canApproveTimesheet, canEditTimesheet } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  calculateDay,
  calculateWeek,
  type TimesheetDayInput,
  type TimesheetStatusValue,
} from "@/lib/timesheet-calculations"

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
  overtimeHours: number
  lastEdited: string
  canEdit: boolean
  canManage: boolean
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
  workedHours: number
  status: string
}

export type TimesheetEditorData = {
  id: string
  userId: string
  employeeName: string
  email: string | null
  role: string
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

export async function getTimesheetOverview(weekStart: Date, currentUser: AppUser): Promise<OverviewRow[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["EMPLOYEE", "MANAGER"] },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    include: {
      manager: true,
      weeklySheets: {
        where: { weekStartDate: weekStart },
        include: { days: true },
      },
    },
  })

  const visibleUsers =
    currentUser.hideSelfFromTimesheetOverview
      ? users.filter((user) => user.id !== currentUser.id)
      : users

  return visibleUsers.map((user) => {
    const sheet = user.weeklySheets[0]
    const sheetStatus = (sheet?.status ?? "NOT_STARTED") as TimesheetStatusValue
    const base = {
      userId: user.id,
      employeeName: displayName(user),
      email: user.email,
      role: user.role,
      managerName: user.manager ? displayName(user.manager) : null,
      canEdit: canEditTimesheet(currentUser, user, sheetStatus),
      canManage: canApproveTimesheet(currentUser, user),
    }

    if (!sheet) {
      return {
        ...base,
        status: "NOT_STARTED" as TimesheetStatusValue,
        completionPercentage: 0,
        completedDays: 0,
        totalWorkedHours: 0,
        totalBreakMinutes: 0,
        regularHours: 0,
        overtimeHours: 0,
        lastEdited: "Not yet",
      }
    }

    return {
      ...base,
      status: sheetStatus,
      completionPercentage: sheet.completionPercentage,
      completedDays: sheet.days.filter((day) => day.status === "COMPLETE" || day.status === "DAY_OFF").length,
      totalWorkedHours: sheet.totalWorkedHours,
      totalBreakMinutes: sheet.totalBreakMinutes,
      regularHours: sheet.regularHours,
      overtimeHours: sheet.overtimeHours,
      lastEdited: formatRelative(sheet.updatedAt),
    }
  })
}

export async function getTimesheetForEditor(
  currentUser: AppUser,
  targetUserId: string,
  weekStart: Date,
): Promise<TimesheetEditorData> {
  await assertCanAccessTimesheet(currentUser, targetUserId)

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  })

  if (!user) {
    throw new Error("Employee not found.")
  }

  const sheet = await getOrCreateWeeklyTimesheet(targetUserId, weekStart)
  const days = sheet.days.map((day) => ({
    id: day.id,
    date: toISODate(day.date),
    dayOfWeek: day.dayOfWeek,
    startTime: day.startTime ?? "",
    endTime: day.endTime ?? "",
    breakMinutes: day.breakMinutes,
    notes: day.notes ?? "",
    isDayOff: day.isDayOff,
    workedHours: day.workedHours,
    status: day.status,
  }))

  const sheetStatus = sheet.status as TimesheetStatusValue

  return {
    id: sheet.id,
    userId: user.id,
    employeeName: displayName(user),
    email: user.email,
    role: user.role,
    weekStartDate: toISODate(sheet.weekStartDate),
    weekEndDate: toISODate(sheet.weekEndDate),
    weekLabel: formatWeekRange(sheet.weekStartDate),
    status: sheetStatus,
    completionPercentage: sheet.completionPercentage,
    completedDays: days.filter((day) => day.status === "COMPLETE" || day.status === "DAY_OFF").length,
    totalWorkedHours: sheet.totalWorkedHours,
    totalBreakMinutes: sheet.totalBreakMinutes,
    regularHours: sheet.regularHours,
    overtimeHours: sheet.overtimeHours,
    submittedAt: sheet.submittedAt?.toISOString() ?? null,
    approvedAt: sheet.approvedAt?.toISOString() ?? null,
    canEdit: canEditTimesheet(currentUser, user, sheetStatus),
    canManage: canApproveTimesheet(currentUser, user),
    days,
  }
}

export async function getOrCreateWeeklyTimesheet(userId: string, weekStart: Date) {
  const existing = await prisma.weeklyTimesheet.findUnique({
    where: {
      userId_weekStartDate: {
        userId,
        weekStartDate: weekStart,
      },
    },
    include: {
      days: {
        orderBy: { date: "asc" },
      },
    },
  })

  if (existing) return existing

  const days = buildWeekDates(weekStart).map(({ date, dayName }) => ({
    date,
    dayOfWeek: dayName,
    breakMinutes: 0,
    notes: null,
    isDayOff: false,
    workedHours: 0,
    status: "EMPTY" as const,
  }))

  return prisma.weeklyTimesheet.create({
    data: {
      userId,
      weekStartDate: weekStart,
      weekEndDate: endOfWeekUTC(weekStart),
      status: "NOT_STARTED",
      days: { create: days },
    },
    include: {
      days: {
        orderBy: { date: "asc" },
      },
    },
  })
}

export function normalizeDayInput(day: TimesheetEditorDay): TimesheetDayInput {
  return {
    id: day.id,
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    startTime: day.isDayOff ? null : day.startTime || null,
    endTime: day.isDayOff ? null : day.endTime || null,
    breakMinutes: day.isDayOff ? 0 : Number(day.breakMinutes) || 0,
    notes: day.notes,
    isDayOff: day.isDayOff,
  }
}

export function calculateRows(days: TimesheetDayInput[]) {
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
      workedHours: calculated.workedHours,
      status: calculated.status,
    }
  })
}

export function calculateTotals(days: TimesheetDayInput[], currentStatus?: TimesheetStatusValue) {
  return calculateWeek(days, currentStatus)
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
