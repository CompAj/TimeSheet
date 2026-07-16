"use server"

import { revalidatePath } from "next/cache"

import { requireAppUser } from "@/lib/auth"
import { parseISODate, toISODate } from "@/lib/dates"
import { recalculatePayPeriod } from "@/lib/payroll-recalculation"
import { isManagerRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { calculateDay } from "@/lib/timesheet-calculations"

export type SettingsActionState = {
  ok: boolean
  message?: string
  error?: string
}

export async function configurePayrollAction(anchorDateValue: string): Promise<SettingsActionState> {
  const currentUser = await requireAppUser()
  if (!isManagerRole(currentUser.role)) return { ok: false, error: "Only managers and admins can configure payroll." }

  const anchorDate = parseISODate(anchorDateValue)
  if (!anchorDate) return { ok: false, error: "Choose a valid payroll start date." }
  if (anchorDate.getUTCDay() !== 0) return { ok: false, error: "The payroll anchor must be a Sunday." }

  try {
    const existing = await prisma.workspaceSettings.findUnique({ where: { id: "workspace" } })
    if (existing?.payPeriodAnchorDate) {
      return { ok: false, error: "The payroll anchor has already been configured and is locked." }
    }

    await prisma.workspaceSettings.upsert({
      where: { id: "workspace" },
      update: {
        payPeriodAnchorDate: anchorDate,
        payrollConfiguredAt: new Date(),
        payrollConfiguredById: currentUser.id,
      },
      create: {
        id: "workspace",
        payPeriodAnchorDate: anchorDate,
        payrollConfiguredAt: new Date(),
        payrollConfiguredById: currentUser.id,
      },
    })

    const existingSheets = await prisma.weeklyTimesheet.findMany({
      select: { userId: true, weekStartDate: true },
      orderBy: { weekStartDate: "asc" },
    })
    const recalculated = new Set<string>()
    for (const sheet of existingSheets) {
      const key = `${sheet.userId}:${toISODate(sheet.weekStartDate)}`
      if (recalculated.has(key)) continue
      await recalculatePayPeriod(sheet.userId, sheet.weekStartDate)
      recalculated.add(key)
    }

    revalidatePath("/", "layout")
    return { ok: true, message: "Biweekly payroll has been configured." }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." }
  }
}

export async function saveHolidayAction(input: { date: string; name: string }): Promise<SettingsActionState> {
  const currentUser = await requireAppUser()
  if (!isManagerRole(currentUser.role)) return { ok: false, error: "Only managers and admins can manage holidays." }

  const date = parseISODate(input.date)
  const name = input.name.trim()
  if (!date) return { ok: false, error: "Choose a valid holiday date." }
  if (!name) return { ok: false, error: "Enter a holiday name." }
  if (name.length > 100) return { ok: false, error: "Holiday names must be 100 characters or fewer." }

  try {
    await prisma.holiday.upsert({
      where: { date },
      update: { name },
      create: { date, name },
    })
    await synchronizeHolidayDays(date, true)
    revalidatePath("/", "layout")
    return { ok: true, message: "Holiday saved." }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." }
  }
}

export async function deleteHolidayAction(holidayId: string): Promise<SettingsActionState> {
  const currentUser = await requireAppUser()
  if (!isManagerRole(currentUser.role)) return { ok: false, error: "Only managers and admins can manage holidays." }

  try {
    const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } })
    if (!holiday) return { ok: false, error: "Holiday not found." }
    await prisma.holiday.delete({ where: { id: holidayId } })
    await synchronizeHolidayDays(holiday.date, false)
    revalidatePath("/", "layout")
    return { ok: true, message: "Holiday removed." }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." }
  }
}

async function synchronizeHolidayDays(date: Date, isHoliday: boolean) {
  const days = await prisma.timesheetDay.findMany({
    where: {
      date,
      holidayOverride: null,
      weeklyTimesheet: { status: { notIn: ["SUBMITTED", "APPROVED"] } },
    },
    include: { weeklyTimesheet: { select: { userId: true, weekStartDate: true } } },
  })

  for (const day of days) {
    const calculated = calculateDay({
      id: day.id,
      date: toISODate(day.date),
      dayOfWeek: day.dayOfWeek,
      startTime: day.startTime,
      endTime: day.endTime,
      breakMinutes: day.breakMinutes,
      notes: day.notes,
      isDayOff: day.isDayOff,
      isHoliday: isHoliday && !day.isDayOff,
    })
    await prisma.timesheetDay.update({
      where: { id: day.id },
      data: { isHoliday: isHoliday && !day.isDayOff, status: calculated.status, workedHours: calculated.workedHours },
    })
  }

  const periods = new Map<string, { userId: string; weekStartDate: Date }>()
  for (const day of days) {
    const value = day.weeklyTimesheet
    periods.set(`${value.userId}:${toISODate(value.weekStartDate)}`, value)
  }
  for (const value of periods.values()) await recalculatePayPeriod(value.userId, value.weekStartDate)
}

export async function updateHideSelfFromTimesheetAction(hide: boolean): Promise<SettingsActionState> {
  const currentUser = await requireAppUser()

  if (!isManagerRole(currentUser.role)) {
    return { ok: false, error: "Only managers and admins can change this setting." }
  }

  try {
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { hideSelfFromTimesheetOverview: hide },
    })

    revalidatePath("/settings/invitations")
    revalidatePath("/timesheets")
    revalidatePath("/dashboard")

    return {
      ok: true,
      message: hide
        ? "Your timesheet is hidden from the team overview."
        : "Your timesheet is visible in the team overview again.",
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." }
  }
}
