"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileEdit,
  Search,
  Send,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { addDaysUTC, toISODate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { formatHours, statusLabel, timesheetActionLabel, type TimesheetStatusValue } from "@/lib/timesheet-calculations"
import type { OverviewRow } from "@/lib/timesheets"
import { TimesheetStatusBadge } from "./timesheet-status-badge"

type SortKey = "name" | "completion" | "hours" | "status"

const STATUS_ORDER: TimesheetStatusValue[] = [
  "NEEDS_REVIEW",
  "NOT_STARTED",
  "IN_PROGRESS",
  "DRAFT",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "APPROVED",
]

export function TimesheetOverview({
  rows,
  weekStartDate,
  weekLabel,
}: {
  rows: OverviewRow[]
  weekStartDate: string
  weekLabel: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("all")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState<SortKey>("completion")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.employeeName.toLowerCase().includes(query) ||
        row.email?.toLowerCase().includes(query) ||
        row.role.toLowerCase().includes(query)
      const matchesRole = role === "all" || row.role === role
      const matchesStatus = status === "all" || row.status === status
      return matchesSearch && matchesRole && matchesStatus
    })

    return [...list].sort((a, b) => {
      if (sort === "name") return a.employeeName.localeCompare(b.employeeName)
      if (sort === "hours") return b.totalWorkedHours - a.totalWorkedHours
      if (sort === "status") return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      return a.completionPercentage - b.completionPercentage
    })
  }, [rows, role, search, sort, status])

  const totals = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        summary.hours += row.totalWorkedHours
        if (row.status === "DRAFT" || row.status === "IN_PROGRESS" || row.status === "NOT_STARTED") {
          summary.drafts += 1
        }
        if (row.status === "READY_TO_SUBMIT") summary.ready += 1
        if (row.status === "SUBMITTED" || row.status === "APPROVED") summary.submitted += 1
        if (row.status === "NEEDS_REVIEW") summary.review += 1
        return summary
      },
      { employees: rows.length, drafts: 0, ready: 0, submitted: 0, review: 0, hours: 0 },
    )
  }, [rows])

  function goToWeek(date: string) {
    router.push(`/timesheets?week=${date}`)
  }

  function shiftWeek(deltaDays: number) {
    goToWeek(toISODate(addDaysUTC(new Date(`${weekStartDate}T00:00:00.000Z`), deltaDays)))
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-6">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employee Timesheet Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review weekly progress, hours, and submission status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-7)} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium">
            <CalendarDays className="size-4 text-muted-foreground" />
            {weekLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(7)} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          <Input
            type="date"
            value={weekStartDate}
            onChange={(event) => goToWeek(event.target.value)}
            className="w-40"
            aria-label="Select week"
          />
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={Users} label="Employees" value={totals.employees} tone="neutral" />
        <SummaryCard icon={FileEdit} label="Drafts" value={totals.drafts} tone="warning" />
        <SummaryCard icon={CheckCircle2} label="Ready" value={totals.ready} tone="success" />
        <SummaryCard icon={Send} label="Submitted" value={totals.submitted} tone="success" />
        <SummaryCard icon={AlertTriangle} label="Needs review" value={totals.review} tone="danger" />
        <SummaryCard icon={Clock3} label="Total hours" value={formatHours(totals.hours)} tone="accent" />
      </section>

      <section className="mb-3 flex flex-col gap-2 rounded-lg border bg-card p-2.5 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees"
            className="pl-9"
          />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:ml-auto lg:max-w-2xl">
          <NativeSelect value={role} onChange={setRole} label="Role">
            <option value="all">All roles</option>
            <option value="EMPLOYEE">Employees</option>
            <option value="MANAGER">Managers</option>
          </NativeSelect>
          <NativeSelect value={status} onChange={setStatus} label="Status">
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={sort} onChange={(value) => setSort(value as SortKey)} label="Sort">
            <option value="completion">Sort: Completion</option>
            <option value="name">Sort: Name</option>
            <option value="hours">Sort: Total hours</option>
            <option value="status">Sort: Status</option>
          </NativeSelect>
        </div>
        <p className="whitespace-nowrap px-1 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
        </p>
      </section>

      <section className="hidden overflow-hidden rounded-lg border bg-card lg:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Team member</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Week</th>
              <th className="px-3 py-2.5 font-medium">Hours</th>
              <th className="px-3 py-2.5 font-medium">Updated</th>
              <th className="px-3 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <OverviewTableRow
                key={row.userId}
                row={row}
                onOpen={() => router.push(`/timesheets/${row.userId}?week=${weekStartDate}`)}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState />}
      </section>

      <section className="grid gap-3 lg:hidden">
        {filtered.map((row) => (
          <article key={row.userId} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={row.employeeName} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium">{row.employeeName}</p>
                    <RoleBadge role={row.role} />
                  </div>
                  {row.email ? (
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground italic">No email yet</p>
                  )}
                </div>
              </div>
              <TimesheetStatusBadge status={row.status} />
            </div>
            <div className="mt-3">
              <CompletionBar percent={row.completionPercentage} days={row.completedDays} status={row.status} />
            </div>
            <div className="mt-3 grid grid-cols-4 divide-x rounded-md bg-muted/60 py-2 text-center text-sm">
              <Stat label="Worked" value={formatHours(row.totalWorkedHours)} />
              <Stat label="Break" value={formatMinutes(row.totalBreakMinutes)} />
              <Stat label="Regular" value={formatHours(row.regularHours)} />
              <Stat label="OT" value={formatHours(row.overtimeHours)} highlight={row.overtimeHours > 0} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="truncate">{row.managerName ? `Manager: ${row.managerName}` : "No manager assigned"}</p>
                <p>Edited {row.lastEdited}</p>
              </div>
              <Button size="sm" onClick={() => router.push(`/timesheets/${row.userId}?week=${weekStartDate}`)}>
                {timesheetActionLabel(row.canEdit, row.canManage, row.status)}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border bg-card">
            <EmptyState />
          </div>
        )}
      </section>
    </main>
  )
}

function OverviewTableRow({ row, onOpen }: { row: OverviewRow; onOpen: () => void }) {
  return (
    <tr className={cn("group border-b last:border-0 hover:bg-muted/30", row.overtimeHours > 0 && "bg-warning/6")}>
      <td className="px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.employeeName} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate font-medium">{row.employeeName}</p>
              <RoleBadge role={row.role} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{row.email ?? "No email yet"}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <TimesheetStatusBadge status={row.status} />
        <p className="mt-1 truncate text-[11px] text-muted-foreground" title={row.managerName ?? undefined}>
          {row.managerName ? `Manager: ${row.managerName}` : "No manager"}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <CompletionBar percent={row.completionPercentage} days={row.completedDays} status={row.status} />
      </td>
      <td className="px-3 py-2.5">
        <p className="font-medium tabular-nums">
          {formatHours(row.totalWorkedHours)}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">worked</span>
        </p>
        <p
          className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground"
          title={`${formatHours(row.regularHours)} regular, ${formatHours(row.overtimeHours)} overtime, ${formatMinutes(row.totalBreakMinutes)} break`}
        >
          {formatHours(row.regularHours)} reg
          <span className="px-1">·</span>
          <span className={cn(row.overtimeHours > 0 && "font-medium text-warning")}>
            {formatHours(row.overtimeHours)} OT
          </span>
          <span className="px-1">·</span>
          {formatMinutes(row.totalBreakMinutes)} break
        </p>
      </td>
      <td className="truncate px-3 py-2.5 text-xs text-muted-foreground" title={row.lastEdited}>
        {row.lastEdited}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button size="sm" className="w-full max-w-28" onClick={onOpen}>
          {timesheetActionLabel(row.canEdit, row.canManage, row.status)}
        </Button>
      </td>
    </tr>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
      {formatRole(role)}
    </Badge>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: string | number
  tone: "neutral" | "warning" | "success" | "danger" | "accent"
}) {
  const toneClass = {
    neutral: "bg-muted text-foreground",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    accent: "bg-primary/10 text-primary",
  }[tone]

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2">
      <div className={cn("flex size-8 items-center justify-center rounded-md", toneClass)}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-5 tabular-nums">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </select>
  )
}

function CompletionBar({
  percent,
  days,
  status,
}: {
  percent: number
  days: number
  status: TimesheetStatusValue
}) {
  const barColor =
    status === "NEEDS_REVIEW"
      ? "bg-destructive"
      : percent === 100
        ? "bg-success"
        : percent === 0
          ? "bg-muted-foreground/30"
          : "bg-warning"

  return (
    <div className="w-full max-w-44">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{percent}%</span>
        <span className="text-muted-foreground">{days}/7</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
      {initials}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 px-1.5">
      <p className={cn("font-semibold tabular-nums", highlight && "text-warning")}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <Search className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">No employees match these filters</p>
      <p className="text-xs text-muted-foreground">Adjust search, role, status, or sort controls.</p>
    </div>
  )
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  return `${Math.round((minutes / 60) * 10) / 10}h`
}
