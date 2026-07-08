import { AppShell } from "@/components/app-shell"
import { TimesheetEditor } from "@/components/timesheet/timesheet-editor"
import { isManagerRole, requireAppUser } from "@/lib/auth"
import { parseWeekStart, toISODate } from "@/lib/dates"
import { getTimesheetForEditor } from "@/lib/timesheets"

export const dynamic = "force-dynamic"

export default async function EmployeeTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const currentUser = await requireAppUser()
  const [{ userId }, { week }] = await Promise.all([params, searchParams])
  const weekStart = parseWeekStart(week)
  const timesheet = await getTimesheetForEditor(currentUser, userId, weekStart)
  const overviewHref = isManagerRole(currentUser.role) ? `/timesheets?week=${toISODate(weekStart)}` : "/dashboard"

  return (
    <AppShell user={currentUser}>
      <TimesheetEditor
        key={`${timesheet.id}-${timesheet.weekStartDate}-${timesheet.status}-${timesheet.completionPercentage}`}
        timesheet={timesheet}
        overviewHref={overviewHref}
      />
    </AppShell>
  )
}
