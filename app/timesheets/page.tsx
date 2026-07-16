import { AppShell } from "@/components/app-shell"
import { PayrollSetupRequired } from "@/components/settings/payroll-setup-required"
import { TimesheetOverview } from "@/components/timesheet/timesheet-overview"
import { requireManagerUser } from "@/lib/auth"
import { formatPayPeriodRange, parsePayPeriodSelection, toISODate } from "@/lib/dates"
import { getPayrollConfiguration } from "@/lib/payroll"
import { getTimesheetOverview } from "@/lib/timesheets"

export const dynamic = "force-dynamic"

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; week?: string }>
}) {
  const user = await requireManagerUser()
  const configuration = await getPayrollConfiguration()
  if (!configuration.anchorDate) {
    return <AppShell user={user}><PayrollSetupRequired canConfigure /></AppShell>
  }
  const { period, week } = await searchParams
  const periodStart = parsePayPeriodSelection(period ?? week, configuration.anchorDate)
  const rows = await getTimesheetOverview(periodStart, user)

  return (
    <AppShell user={user}>
      <TimesheetOverview rows={rows} periodStartDate={toISODate(periodStart)} periodLabel={formatPayPeriodRange(periodStart)} />
    </AppShell>
  )
}
