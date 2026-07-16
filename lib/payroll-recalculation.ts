import "server-only"

import { addDaysUTC, resolvePayPeriodStart } from "@/lib/dates"
import { requirePayrollAnchor } from "@/lib/payroll"
import { prisma } from "@/lib/prisma"
import {
  calculatePeriodTotals,
  databaseDayToInput,
  getOrCreateWeeklyTimesheet,
} from "@/lib/timesheets"
import type { TimesheetStatusValue } from "@/lib/timesheet-calculations"

export async function recalculatePayPeriod(userId: string, weekStart: Date, editedSheetId?: string) {
  const anchor = await requirePayrollAnchor()
  const periodStart = resolvePayPeriodStart(weekStart, anchor)
  const starts = [periodStart, addDaysUTC(periodStart, 7)]
  const sheets = []
  for (const start of starts) sheets.push(await getOrCreateWeeklyTimesheet(userId, start))

  const period = calculatePeriodTotals(
    sheets.map((sheet) => ({
      days: sheet.days.map(databaseDayToInput),
      currentStatus: sheet.id === editedSheetId ? undefined : (sheet.status as TimesheetStatusValue),
    })),
  )

  await prisma.$transaction(
    sheets.map((sheet, index) =>
      prisma.weeklyTimesheet.update({
        where: { id: sheet.id },
        data: {
          ...(sheet.id === editedSheetId ? { status: period.weeks[index].status } : {}),
          completionPercentage: period.weeks[index].completionPercentage,
          totalWorkedHours: period.weeks[index].totalWorkedHours,
          totalBreakMinutes: period.weeks[index].totalBreakMinutes,
          regularHours: period.weeks[index].regularHours,
          overtimeHours: period.weeks[index].overtimeHours,
        },
      }),
    ),
  )
}
