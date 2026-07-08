"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Moon,
  RotateCcw,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react"

import {
  approveTimesheetAction,
  markNeedsReviewAction,
  resetTimesheetAction,
  saveTimesheetDraftAction,
  submitTimesheetAction,
} from "@/app/actions/timesheets"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { addDaysUTC, toISODate } from "@/lib/dates"
import {
  calculateWeek,
  formatHours,
  safeCalculateDay,
  STANDARD_WEEK_HOURS,
  type TimesheetDayInput,
} from "@/lib/timesheet-calculations"
import type { TimesheetEditorData, TimesheetEditorDay } from "@/lib/timesheets"
import { cn } from "@/lib/utils"
import { DayStatusBadge } from "./day-status-badge"
import { TimesheetStatusBadge } from "./timesheet-status-badge"

export function TimesheetEditor({
  timesheet,
  overviewHref,
}: {
  timesheet: TimesheetEditorData
  overviewHref: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [days, setDays] = useState(timesheet.days)
  const [isPending, startTransition] = useTransition()

  const calculated = useMemo(() => {
    const inputs = days.map(toCalculationInput)
    return calculateWeek(inputs, timesheet.status, { safe: true })
  }, [days, timesheet.status])

  const canSubmit = calculated.completedDays === 7 && timesheet.status !== "SUBMITTED" && timesheet.status !== "APPROVED"

  function updateDay(id: string, patch: Partial<TimesheetEditorDay>) {
    setDays((current) => current.map((day) => (day.id === id ? { ...day, ...patch } : day)))
  }

  function copyFromPreviousDay(index: number) {
    if (index === 0) return
    const previous = days[index - 1]
    const current = days[index]
    updateDay(current.id, {
      startTime: previous.isDayOff ? "" : previous.startTime,
      endTime: previous.isDayOff ? "" : previous.endTime,
      breakMinutes: previous.isDayOff ? 0 : previous.breakMinutes,
      isDayOff: previous.isDayOff,
    })
    toast.success(`Copied ${previous.dayOfWeek}'s hours to ${current.dayOfWeek}.`)
  }

  function copyMondayToWeekdays() {
    const monday = days[0]
    setDays((current) =>
      current.map((day, index) =>
        index > 0 && index < 5
          ? {
              ...day,
              startTime: monday.startTime,
              endTime: monday.endTime,
              breakMinutes: monday.breakMinutes,
              isDayOff: false,
            }
          : day,
      ),
    )
    toast.success("Copied Monday's hours to Tuesday through Friday.")
  }

  function shiftWeek(daysToShift: number) {
    const date = toISODate(addDaysUTC(new Date(`${timesheet.weekStartDate}T00:00:00.000Z`), daysToShift))
    router.push(`/timesheets/${timesheet.userId}?week=${date}`)
  }

  function runAction(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message ?? "Saved.")
        router.refresh()
      } else {
        toast.error(result.error ?? "Something went wrong.")
      }
    })
  }

  function saveDraft() {
    runAction(() => saveTimesheetDraftAction({ timesheetId: timesheet.id, days }))
  }

  function submitTimesheet() {
    runAction(async () => {
      const saved = await saveTimesheetDraftAction({ timesheetId: timesheet.id, days })
      if (!saved.ok) return saved
      return submitTimesheetAction(timesheet.id)
    })
  }

  function resetWeek() {
    runAction(() => resetTimesheetAction(timesheet.id))
  }

  function approve() {
    runAction(() => approveTimesheetAction(timesheet.id))
  }

  function markNeedsReview() {
    runAction(() => markNeedsReviewAction(timesheet.id))
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-4">
        <Link href={overviewHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <header className="mb-6 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{timesheet.employeeName}</h1>
              <TimesheetStatusBadge status={timesheet.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {timesheet.email} - {timesheet.role}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftWeek(-7)} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium">
              <CalendarDays className="size-4 text-muted-foreground" />
              {timesheet.weekLabel}
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftWeek(7)} aria-label="Next week">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">
                {calculated.completedDays === 7
                  ? "All days complete"
                  : `${calculated.completedDays}/7 days complete`}
              </span>
              <span className="tabular-nums text-muted-foreground">{calculated.completionPercentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  calculated.completionPercentage === 100 ? "bg-success" : "bg-warning",
                )}
                style={{ width: `${calculated.completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyMondayToWeekdays} disabled={!timesheet.canEdit || isPending}>
              <Copy className="size-4" />
              Copy Monday
            </Button>
            <Button variant="outline" onClick={resetWeek} disabled={!timesheet.canEdit || isPending}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button variant="outline" onClick={saveDraft} disabled={!timesheet.canEdit || isPending}>
              <Save className="size-4" />
              Save Draft
            </Button>
            <Button onClick={submitTimesheet} disabled={!timesheet.canEdit || !canSubmit || isPending}>
              <Send className="size-4" />
              Submit
            </Button>
          </div>
        </div>

        {timesheet.canManage && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" onClick={approve} disabled={isPending}>
              <ClipboardCheck className="size-4" />
              Approve
            </Button>
            <Button variant="destructive" onClick={markNeedsReview} disabled={isPending}>
              <TriangleAlert className="size-4" />
              Needs Review
            </Button>
          </div>
        )}

        {!timesheet.canEdit && (
          <div className="mt-4 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
            {timesheet.role === "EMPLOYEE"
              ? "This timesheet is view-only. Contact your manager to make changes."
              : timesheet.status === "SUBMITTED" || timesheet.status === "APPROVED"
                ? "This timesheet is locked because it has been submitted or approved."
                : "This timesheet is view-only for your role."}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="grid gap-3">
          {days.map((day, index) => (
            <DayEditorCard
              key={day.id}
              day={day}
              previousDay={index > 0 ? days[index - 1] : null}
              disabled={!timesheet.canEdit || isPending}
              onChange={(patch) => updateDay(day.id, patch)}
              onCopyPrevious={() => copyFromPreviousDay(index)}
            />
          ))}
        </section>
        <aside className="rounded-lg border bg-card p-4 lg:sticky lg:top-20">
          <h2 className="font-semibold tracking-tight">Weekly summary</h2>
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total worked</span>
              <span className={cn("text-3xl font-semibold tabular-nums", calculated.overtimeHours > 0 && "text-warning")}>
                {formatHours(calculated.totalWorkedHours)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", calculated.overtimeHours > 0 ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.min(100, (calculated.totalWorkedHours / STANDARD_WEEK_HOURS) * 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm">
            <SummaryRow label="Regular hours" value={formatHours(calculated.regularHours)} />
            <SummaryRow label="Overtime hours" value={formatHours(calculated.overtimeHours)} warning={calculated.overtimeHours > 0} />
            <SummaryRow label="Total breaks" value={formatMinutes(calculated.totalBreakMinutes)} />
            <SummaryRow label="Completed days" value={`${calculated.completedDays}/7`} />
          </div>
          {calculated.overtimeHours > 0 && (
            <div className="mt-5 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              {formatHours(calculated.overtimeHours)} of overtime this week.
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function DayEditorCard({
  day,
  previousDay,
  disabled,
  onChange,
  onCopyPrevious,
}: {
  day: TimesheetEditorDay
  previousDay: TimesheetEditorDay | null
  disabled: boolean
  onChange: (patch: Partial<TimesheetEditorDay>) => void
  onCopyPrevious: () => void
}) {
  const result = safeCalculateDay(toCalculationInput(day))
  const status = result.status
  const isOff = day.isDayOff

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4",
        status === "INCOMPLETE" && "border-warning/30 bg-warning/5",
        isOff && "bg-muted/50",
        result.error && "border-destructive/30 bg-destructive/4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 flex-col items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">{day.dayOfWeek.slice(0, 3)}</span>
          </div>
          <div>
            <p className="font-semibold">{day.dayOfWeek}</p>
            <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
          </div>
        </div>
        <div className="text-right">
          <DayStatusBadge status={status} />
          <p className="mt-1 text-lg font-semibold tabular-nums">{isOff ? "0.0h" : formatHours(result.workedHours)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[8rem_8rem_8rem_1fr]">
        <Field label="Start" htmlFor={`${day.id}-start`}>
          <Input
            id={`${day.id}-start`}
            type="time"
            value={day.startTime}
            disabled={disabled || isOff}
            onChange={(event) => onChange({ startTime: event.target.value })}
          />
        </Field>
        <Field label="End" htmlFor={`${day.id}-end`}>
          <Input
            id={`${day.id}-end`}
            type="time"
            value={day.endTime}
            disabled={disabled || isOff}
            onChange={(event) => onChange({ endTime: event.target.value })}
          />
        </Field>
        <Field label="Break min" htmlFor={`${day.id}-break`}>
          <Input
            id={`${day.id}-break`}
            type="number"
            min={0}
            step={5}
            value={day.breakMinutes}
            disabled={disabled || isOff}
            onChange={(event) => onChange({ breakMinutes: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label="Notes" htmlFor={`${day.id}-notes`}>
          <Textarea
            id={`${day.id}-notes`}
            value={day.notes}
            disabled={disabled}
            rows={2}
            placeholder="Optional"
            onChange={(event) => onChange({ notes: event.target.value })}
            className="min-h-9 md:min-h-9"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {previousDay && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onCopyPrevious}
          >
            <Copy className="size-3.5" />
            Copy from {previousDay.dayOfWeek}
          </Button>
        )}
        <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={day.isDayOff}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                isDayOff: event.target.checked,
                startTime: event.target.checked ? "" : day.startTime,
                endTime: event.target.checked ? "" : day.endTime,
                breakMinutes: event.target.checked ? 0 : day.breakMinutes,
              })
            }
            className="size-4 rounded border-input"
          />
          <Moon className="size-4" aria-hidden="true" />
          Day off
        </label>
        {status === "COMPLETE" && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            Complete
          </span>
        )}
        {result.error && <span className="text-xs font-medium text-destructive">{result.error}</span>}
      </div>
    </article>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[11px] uppercase text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", warning && "text-warning")}>{value}</span>
    </div>
  )
}

function toCalculationInput(day: TimesheetEditorDay): TimesheetDayInput {
  return {
    id: day.id,
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    startTime: day.startTime || null,
    endTime: day.endTime || null,
    breakMinutes: Number(day.breakMinutes) || 0,
    notes: day.notes,
    isDayOff: day.isDayOff,
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  return `${Math.round((minutes / 60) * 10) / 10}h`
}
