"use server"

import { revalidatePath } from "next/cache"

import { assertCanAccessTimesheet, requireAppUser } from "@/lib/auth"
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

    const validDayIds = new Set(sheet.days.map((day) => day.id))
    if (input.days.some((day) => !validDayIds.has(day.id))) {
      return failure("One or more days do not belong to this timesheet.")
    }

    const normalized = input.days.map(normalizeDayInput)
    const rows = calculateRows(normalized)
    const totals = calculateTotals(normalized, sheet.status as TimesheetStatusValue)

    await prisma.$transaction(async (tx) => {
      for (const day of input.days) {
        const row = rows.find((candidate) => candidate.date.toISOString().slice(0, 10) === day.date)
        if (!row) continue

        await tx.timesheetDay.update({
          where: { id: day.id },
          data: row,
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
    }))
    const totals = calculateTotals(inputs)

    if (totals.completedDays !== 7) {
      return failure("All 7 days must be complete or marked as day off before submission.")
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

    await prisma.$transaction(async (tx) => {
      await tx.timesheetDay.updateMany({
        where: { weeklyTimesheetId: sheet.id },
        data: {
          startTime: null,
          endTime: null,
          breakMinutes: 0,
          notes: null,
          isDayOff: false,
          workedHours: 0,
          status: "EMPTY",
        },
      })

      await tx.weeklyTimesheet.update({
        where: { id: sheet.id },
        data: {
          status: "NOT_STARTED",
          completionPercentage: 0,
          totalWorkedHours: 0,
          totalBreakMinutes: 0,
          regularHours: 0,
          overtimeHours: 0,
          submittedAt: null,
          approvedAt: null,
        },
      })
    })

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
