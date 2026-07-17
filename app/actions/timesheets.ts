"use server"

import { revalidatePath } from "next/cache"

import { assertCanAccessTimesheet, requireAppUser } from "@/lib/auth"
import { recalculatePayPeriod } from "@/lib/payroll-recalculation"
import {
  canApproveTimesheet,
  canEditTimesheet,
  canResetTimesheet,
} from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  calculateRows,
  calculateTotals,
  normalizeDayInput,
  type TimesheetEditorDay,
} from "@/lib/timesheets"
import type { TimesheetStatusValue } from "@/lib/timesheet-calculations"

type ActionResult = {
  ok: boolean
  message?: string
  error?: string
}

export async function saveTimesheetDraftAction(input: {
  timesheetId: string
  days: TimesheetEditorDay[]
}): Promise<ActionResult> {
  const currentUser = await requireAppUser()

  try {
    const sheet = await prisma.weeklyTimesheet.findUnique({
      where: { id: input.timesheetId },
      include: { days: true },
    })

    if (!sheet) return failure("Timesheet not found.")
    await assertCanAccessTimesheet(currentUser, sheet.userId)

    const targetUser = await prisma.user.findUnique({
      where: { id: sheet.userId },
      select: { id: true, role: true },
    })
    if (!targetUser) return failure("Employee not found.")

    if (!canEditTimesheet(currentUser, targetUser, sheet.status as TimesheetStatusValue)) {
      return failure("You do not have permission to edit this timesheet.")
    }

    if (input.days.length !== 7) {
      return failure("A weekly timesheet must contain exactly 7 days.")
    }

    const submittedDaysById = new Map(input.days.map((day) => [day.id, day]))
    const validDayIds = new Set(sheet.days.map((day) => day.id))
    if (
      submittedDaysById.size !== sheet.days.length ||
      input.days.some((day) => !validDayIds.has(day.id))
    ) {
      return failure("One or more days do not belong to this timesheet.")
    }

    const normalized = sheet.days
      .toSorted((a, b) => a.date.getTime() - b.date.getTime())
      .map((savedDay) => {
        const submittedDay = submittedDaysById.get(savedDay.id)
        if (!submittedDay) {
          throw new Error("One or more days are missing from this timesheet.")
        }

        return normalizeDayInput({
          ...submittedDay,
          id: savedDay.id,
          date: savedDay.date.toISOString().slice(0, 10),
          dayOfWeek: savedDay.dayOfWeek,
        })
      })
    const rows = calculateRows(normalized)
    const totals = calculateTotals(normalized)

    await prisma.$transaction(async (tx) => {
      for (const [index, day] of normalized.entries()) {
        await tx.timesheetDay.update({
          where: { id: day.id },
          data: rows[index],
        })
      }

      await tx.weeklyTimesheet.update({
        where: { id: sheet.id },
        data: {
          status: totals.status,
          completionPercentage: totals.completionPercentage,
          totalWorkedHours: totals.totalWorkedHours,
          totalBreakMinutes: totals.totalBreakMinutes,
          regularHours: totals.regularHours,
          overtimeHours: totals.overtimeHours,
          approvedAt: totals.status === "APPROVED" ? sheet.approvedAt : null,
        },
      })
    })

    await recalculatePayPeriod(sheet.userId, sheet.weekStartDate, sheet.id)

    revalidateTimesheetPaths(sheet.userId)
    return { ok: true, message: "Draft saved." }
  } catch (error) {
    return failure(getErrorMessage(error))
  }
}

export async function submitTimesheetAction(timesheetId: string): Promise<ActionResult> {
  const currentUser = await requireAppUser()

  try {
    const sheet = await prisma.weeklyTimesheet.findUnique({
      where: { id: timesheetId },
      include: { days: { orderBy: { date: "asc" } } },
    })

    if (!sheet) return failure("Timesheet not found.")
    await assertCanAccessTimesheet(currentUser, sheet.userId)

    const targetUser = await prisma.user.findUnique({
      where: { id: sheet.userId },
      select: { id: true, role: true },
    })
    if (!targetUser) return failure("Employee not found.")

    if (!canEditTimesheet(currentUser, targetUser, sheet.status as TimesheetStatusValue)) {
      return failure("You do not have permission to submit this timesheet.")
    }

    if (sheet.status === "APPROVED") {
      return failure("Approved timesheets cannot be submitted again.")
    }

    if (sheet.status === "SUBMITTED") {
      return failure("This timesheet has already been submitted.")
    }

    const inputs = sheet.days.map((day) => ({
      id: day.id,
      date: day.date.toISOString().slice(0, 10),
      dayOfWeek: day.dayOfWeek,
      startTime: day.startTime,
      endTime: day.endTime,
      breakMinutes: day.breakMinutes,
      notes: day.notes,
      isDayOff: day.isDayOff,
      isHoliday: day.isHoliday,
    }))
    const totals = calculateTotals(inputs)

    if (totals.completedDays !== 7) {
      return failure("All 7 days must be complete, marked as day off, or identified as a holiday before submission.")
    }

    await prisma.weeklyTimesheet.update({
      where: { id: sheet.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        approvedAt: null,
        completionPercentage: totals.completionPercentage,
        totalWorkedHours: totals.totalWorkedHours,
        totalBreakMinutes: totals.totalBreakMinutes,
        regularHours: totals.regularHours,
        overtimeHours: totals.overtimeHours,
      },
    })

    await recalculatePayPeriod(sheet.userId, sheet.weekStartDate)

    revalidateTimesheetPaths(sheet.userId)
    return { ok: true, message: "Timesheet submitted." }
  } catch (error) {
    return failure(getErrorMessage(error))
  }
}

export async function approveTimesheetAction(timesheetId: string): Promise<ActionResult> {
  const currentUser = await requireAppUser()

  try {
    const sheet = await prisma.weeklyTimesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, userId: true },
    })
    if (!sheet) return failure("Timesheet not found.")

    const targetUser = await prisma.user.findUnique({
      where: { id: sheet.userId },
      select: { id: true, role: true },
    })
    if (!targetUser) return failure("Employee not found.")

    if (!canApproveTimesheet(currentUser, targetUser)) {
      return failure("You do not have permission to approve this timesheet.")
    }

    await prisma.weeklyTimesheet.update({
      where: { id: timesheetId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },
    })

    const updatedSheet = await prisma.weeklyTimesheet.findUnique({ where: { id: timesheetId }, select: { weekStartDate: true } })
    if (updatedSheet) await recalculatePayPeriod(sheet.userId, updatedSheet.weekStartDate)

    revalidateTimesheetPaths(sheet.userId)
    return { ok: true, message: "Timesheet approved." }
  } catch (error) {
    return failure(getErrorMessage(error))
  }
}

export async function markNeedsReviewAction(timesheetId: string): Promise<ActionResult> {
  const currentUser = await requireAppUser()

  try {
    const sheet = await prisma.weeklyTimesheet.findUnique({
      where: { id: timesheetId },
      select: { id: true, userId: true },
    })
    if (!sheet) return failure("Timesheet not found.")

    const targetUser = await prisma.user.findUnique({
      where: { id: sheet.userId },
      select: { id: true, role: true },
    })
    if (!targetUser) return failure("Employee not found.")

    if (!canApproveTimesheet(currentUser, targetUser)) {
      return failure("You do not have permission to mark this timesheet for review.")
    }

    await prisma.weeklyTimesheet.update({
      where: { id: timesheetId },
      data: {
        status: "NEEDS_REVIEW",
        approvedAt: null,
      },
    })

    const updatedSheet = await prisma.weeklyTimesheet.findUnique({ where: { id: timesheetId }, select: { weekStartDate: true } })
    if (updatedSheet) await recalculatePayPeriod(sheet.userId, updatedSheet.weekStartDate)

    revalidateTimesheetPaths(sheet.userId)
    return { ok: true, message: "Timesheet marked for review." }
  } catch (error) {
    return failure(getErrorMessage(error))
  }
}

export async function resetTimesheetAction(timesheetId: string): Promise<ActionResult> {
  const currentUser = await requireAppUser()

  try {
    const sheet = await prisma.weeklyTimesheet.findUnique({
      where: { id: timesheetId },
      include: { days: true },
    })

    if (!sheet) return failure("Timesheet not found.")
    await assertCanAccessTimesheet(currentUser, sheet.userId)

    const targetUser = await prisma.user.findUnique({
      where: { id: sheet.userId },
      select: { id: true, role: true },
    })
    if (!targetUser) return failure("Employee not found.")

    if (!canResetTimesheet(currentUser, targetUser, sheet.status as TimesheetStatusValue)) {
      return failure("You do not have permission to reset this timesheet.")
    }

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: sheet.weekStartDate, lte: sheet.weekEndDate } },
      select: { date: true },
    })
    const holidayDates = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)))

    await prisma.$transaction(async (tx) => {
      for (const day of sheet.days) {
        const isHoliday = holidayDates.has(day.date.toISOString().slice(0, 10))
        await tx.timesheetDay.update({
          where: { id: day.id },
          data: {
          startTime: null,
          endTime: null,
          breakMinutes: 0,
          notes: null,
          isDayOff: false,
          isHoliday,
          holidayOverride: null,
          workedHours: 0,
          status: isHoliday ? "HOLIDAY" : "EMPTY",
          },
        })
      }

      const holidayCount = sheet.days.filter((day) => holidayDates.has(day.date.toISOString().slice(0, 10))).length

      await tx.weeklyTimesheet.update({
        where: { id: sheet.id },
        data: {
          status: holidayCount ? "DRAFT" : "NOT_STARTED",
          completionPercentage: Math.round((holidayCount / 7) * 100),
          totalWorkedHours: 0,
          totalBreakMinutes: 0,
          regularHours: 0,
          overtimeHours: 0,
          submittedAt: null,
          approvedAt: null,
        },
      })
    })

    await recalculatePayPeriod(sheet.userId, sheet.weekStartDate)

    revalidateTimesheetPaths(sheet.userId)
    return { ok: true, message: "Week reset." }
  } catch (error) {
    return failure(getErrorMessage(error))
  }
}


function revalidateTimesheetPaths(userId: string) {
  revalidatePath("/dashboard")
  revalidatePath("/timesheets")
  revalidatePath(`/timesheets/${userId}`)
}

function failure(error: string): ActionResult {
  return { ok: false, error }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}
