import { AppShell } from "@/components/app-shell"
import { TimesheetOverview } from "@/components/timesheet/timesheet-overview"
import { requireManagerUser } from "@/lib/auth"
import { formatWeekRange, parseWeekStart, toISODate } from "@/lib/dates"
import { getTimesheetOverview } from "@/lib/timesheets"

export const dynamic = "force-dynamic"

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireManagerUser()
  const { week } = await searchParams
  const weekStart = parseWeekStart(week)
  const rows = await getTimesheetOverview(weekStart, user)

  return (
    <AppShell user={user}>
      <TimesheetOverview rows={rows} weekStartDate={toISODate(weekStart)} weekLabel={formatWeekRange(weekStart)} />
    </AppShell>
  )
}
