import Link from "next/link"
import { CalendarClock, CheckCircle2, Clock3, Users } from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { buttonVariants } from "@/components/ui/button"
import { requireAppUser, isManagerRole } from "@/lib/auth"
import { formatWeekRange, startOfWeekUTC, toISODate } from "@/lib/dates"
import {
  getAllTimeWorkedHours,
  getTimesheetForEditor,
  getTimesheetOverview,
} from "@/lib/timesheets"
import { formatHours } from "@/lib/timesheet-calculations"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await requireAppUser()
  const weekStart = startOfWeekUTC()
  const week = toISODate(weekStart)

  if (isManagerRole(user.role)) {
    const [rows, allTimeWorkedHours] = await Promise.all([
      getTimesheetOverview(weekStart, user),
      getAllTimeWorkedHours(user),
    ])
    const employees = rows.filter((row) => row.role === "EMPLOYEE")
    const ready = employees.filter((row) => row.status === "READY_TO_SUBMIT").length
    const submitted = employees.filter((row) => row.status === "SUBMITTED" || row.status === "APPROVED").length

    return (
      <AppShell user={user}>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatWeekRange(weekStart)}</p>
          </header>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard icon={Users} label="Employees" value={employees.length} />
            <DashboardCard icon={CheckCircle2} label="Ready to submit" value={ready} />
            <DashboardCard icon={CalendarClock} label="Submitted" value={submitted} />
            <DashboardCard icon={Clock3} label="All-time hours" value={formatHours(allTimeWorkedHours)} />
          </section>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/timesheets?week=${week}`} className={buttonVariants()}>
              Open Timesheets
            </Link>
            <Link href={`/timesheets/${user.id}?week=${week}`} className={buttonVariants({ variant: "outline" })}>
              My Timesheet
            </Link>
            <Link href="/settings/invitations" className={buttonVariants({ variant: "outline" })}>
              Manage Users
            </Link>
          </div>
        </main>
      </AppShell>
    )
  }

  const timesheet = await getTimesheetForEditor(user, user.id, weekStart)

  return (
    <AppShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatWeekRange(weekStart)}</p>
        </header>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard icon={CalendarClock} label="Status" value={timesheet.status.replaceAll("_", " ")} />
          <DashboardCard icon={CheckCircle2} label="Completion" value={`${timesheet.completedDays}/7 days`} />
          <DashboardCard icon={Clock3} label="Worked" value={formatHours(timesheet.totalWorkedHours)} />
          <DashboardCard icon={Clock3} label="Overtime" value={formatHours(timesheet.overtimeHours)} />
        </section>
        <div className="mt-6">
          <Link href={`/timesheets/${user.id}?week=${week}`} className={buttonVariants()}>
            View My Timesheet
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Your timesheet is view-only. Contact your manager if changes are needed.
          </p>
        </div>
      </main>
    </AppShell>
  )
}

function DashboardCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={cn("flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary")}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
