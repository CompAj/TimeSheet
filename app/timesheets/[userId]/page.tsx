import { AppShell } from "@/components/app-shell"
import { PayrollSetupRequired } from "@/components/settings/payroll-setup-required"
import { TimesheetEditor } from "@/components/timesheet/timesheet-editor"
import { isManagerRole, requireAppUser } from "@/lib/auth"
import { parsePayPeriodSelection, toISODate } from "@/lib/dates"
import { getPayrollConfiguration } from "@/lib/payroll"
import { getTimesheetForEditor } from "@/lib/timesheets"

export const dynamic = "force-dynamic"

export default async function EmployeeTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ period?: string; week?: string }>
}) {
  const currentUser = await requireAppUser()
  const [{ userId }, { period, week }, configuration] = await Promise.all([params, searchParams, getPayrollConfiguration()])
  if (!configuration.anchorDate) {
    return <AppShell user={currentUser}><PayrollSetupRequired canConfigure={isManagerRole(currentUser.role)} /></AppShell>
  }
  const periodStart = parsePayPeriodSelection(period ?? week, configuration.anchorDate)
  const timesheet = await getTimesheetForEditor(currentUser, userId, periodStart)
  const overviewHref = isManagerRole(currentUser.role) ? `/timesheets?period=${toISODate(periodStart)}` : "/dashboard"

  return (
    <AppShell user={currentUser}>
      <TimesheetEditor
        key={`${timesheet.userId}-${timesheet.periodStartDate}-${timesheet.weeks.map((item) => item.status).join("-")}-${timesheet.completionPercentage}`}
        timesheet={timesheet}
        overviewHref={overviewHref}
      />
    </AppShell>
  )
}
