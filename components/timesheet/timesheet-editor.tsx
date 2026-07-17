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
  RotateCcw,
  Save,
  Send,
  Sparkles,
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
  calculatePayPeriod,
  formatHours,
  safeCalculateDay,
  STANDARD_PAY_PERIOD_HOURS,
  type TimesheetDayInput,
} from "@/lib/timesheet-calculations"
import type { TimesheetEditorData, TimesheetEditorDay, TimesheetEditorWeek } from "@/lib/timesheets"
import { cn } from "@/lib/utils"
import { DayStatusBadge } from "./day-status-badge"
import { TimesheetStatusBadge } from "./timesheet-status-badge"

export function TimesheetEditor({ timesheet, overviewHref }: { timesheet: TimesheetEditorData; overviewHref: string }) {
  const router = useRouter()
  const toast = useToast()
  const [weeks, setWeeks] = useState(timesheet.weeks)
  const [isPending, startTransition] = useTransition()

  const calculated = useMemo(
    () => calculatePayPeriod(weeks.map((week) => ({ days: week.days.map(toCalculationInput), currentStatus: week.status })), { safe: true }),
    [weeks],
  )

  function updateDay(weekIndex: number, id: string, patch: Partial<TimesheetEditorDay>) {
    setWeeks((current) => current.map((week, index) => index === weekIndex
      ? { ...week, days: week.days.map((day) => day.id === id ? { ...day, ...patch } : day) }
      : week))
  }

  function copyPrevious(weekIndex: number, dayIndex: number) {
    if (dayIndex === 0) return
    const previous = weeks[weekIndex].days[dayIndex - 1]
    const day = weeks[weekIndex].days[dayIndex]
    updateDay(weekIndex, day.id, {
      startTime: previous.isDayOff ? "" : previous.startTime,
      endTime: previous.isDayOff ? "" : previous.endTime,
      breakMinutes: previous.isDayOff ? 0 : previous.breakMinutes,
      isDayOff: previous.isDayOff,
    })
    toast.success(`Copied ${previous.dayOfWeek}'s hours.`)
  }

  function copyMonday(weekIndex: number) {
    setWeeks((current) => current.map((week, index) => {
      if (index !== weekIndex) return week
      const monday = week.days[1]
      return {
        ...week,
        days: week.days.map((day, dayIndex) => dayIndex >= 2 && dayIndex <= 5
          ? { ...day, startTime: monday.startTime, endTime: monday.endTime, breakMinutes: monday.breakMinutes, isDayOff: false }
          : day),
      }
    }))
    toast.success("Copied Monday's hours to Tuesday through Friday.")
  }

  function shiftPeriod(days: number) {
    const next = toISODate(addDaysUTC(new Date(`${timesheet.periodStartDate}T00:00:00.000Z`), days))
    router.push(`/timesheets/${timesheet.userId}?period=${next}`)
  }

  function runAction(action: () => Promise<{ ok: boolean; message?: string; error?: string }>, returnToOverview = false) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message ?? "Saved.")
        if (returnToOverview) router.push(overviewHref)
        else router.refresh()
      } else toast.error(result.error ?? "Something went wrong.")
    })
  }

  function submitWeek(week: TimesheetEditorWeek) {
    startTransition(async () => {
      const saved = await saveTimesheetDraftAction({ timesheetId: week.id, days: week.days })
      if (!saved.ok) return toast.error(saved.error ?? "Unable to save this week.")
      const submitted = await submitTimesheetAction(week.id)
      if (submitted.ok) {
        toast.success(submitted.message ?? "Week submitted.")
        router.refresh()
      } else toast.error(submitted.error ?? "Unable to submit this week.")
    })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <Link href={overviewHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <header className="mt-4 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{timesheet.employeeName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{[timesheet.email, timesheet.role].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {weeks.map((week, index) => <span key={week.id} className="inline-flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Week {index + 1}</span><TimesheetStatusBadge status={week.status} /></span>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftPeriod(-14)} aria-label="Previous pay period"><ChevronLeft className="size-4" /></Button>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium"><CalendarDays className="size-4 text-muted-foreground" />{timesheet.periodLabel}</div>
            <Button variant="outline" size="icon" onClick={() => shiftPeriod(14)} aria-label="Next pay period"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{calculated.completedDays}/14 days complete</span><span className="text-muted-foreground">{calculated.completionPercentage}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", calculated.completionPercentage === 100 ? "bg-success" : "bg-warning")} style={{ width: `${calculated.completionPercentage}%` }} /></div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid gap-8">
          {weeks.map((week, weekIndex) => {
            const weekCalculation = calculated.weeks[weekIndex]
            const canSubmit = weekCalculation.completedDays === 7 && !["SUBMITTED", "APPROVED"].includes(week.status)
            const showManagerActions = week.canManage && week.status === "SUBMITTED"
            return (
              <section key={week.id} className="grid gap-3">
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><div className="flex items-center gap-2"><h2 className="font-semibold">Week {weekIndex + 1}</h2><TimesheetStatusBadge status={week.status} /></div><p className="mt-0.5 text-xs text-muted-foreground">{week.weekLabel} · {weekCalculation.completedDays}/7 complete</p></div>
                    <div className="flex flex-wrap gap-2">
                      {week.canEdit && <>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => copyMonday(weekIndex)}><Copy className="size-3.5" />Copy Monday</Button>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => runAction(() => resetTimesheetAction(week.id))}><RotateCcw className="size-3.5" />Reset</Button>
                        <Button variant="outline" size="sm" disabled={isPending} onClick={() => runAction(() => saveTimesheetDraftAction({ timesheetId: week.id, days: week.days }))}><Save className="size-3.5" />Save</Button>
                        <Button size="sm" disabled={isPending || !canSubmit} onClick={() => submitWeek(week)}><Send className="size-3.5" />Submit</Button>
                      </>}
                      {showManagerActions && <>
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => runAction(() => approveTimesheetAction(week.id))}><ClipboardCheck className="size-3.5" />Approve</Button>
                        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => runAction(() => markNeedsReviewAction(week.id))}><TriangleAlert className="size-3.5" />Needs review</Button>
                      </>}
                    </div>
                  </div>
                </div>
                {week.days.map((day, dayIndex) => (
                  <DayEditorCard key={day.id} day={day} previousDay={dayIndex ? week.days[dayIndex - 1] : null} disabled={!week.canEdit || isPending} onChange={(patch) => updateDay(weekIndex, day.id, patch)} onCopyPrevious={() => copyPrevious(weekIndex, dayIndex)} />
                ))}
              </section>
            )
          })}
        </div>

        <aside className="rounded-lg border bg-card p-4 lg:sticky lg:top-20">
          <h2 className="font-semibold tracking-tight">Pay period summary</h2>
          <div className="mt-4 flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Total worked</span><span className={cn("text-3xl font-semibold tabular-nums", calculated.overtimeHours > 0 && "text-warning")}>{formatHours(calculated.totalWorkedHours)}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", calculated.overtimeHours > 0 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (calculated.totalWorkedHours / STANDARD_PAY_PERIOD_HOURS) * 100)}%` }} /></div>
          <div className="mt-5 grid gap-3 text-sm">
            <SummaryRow label="Regular hours" value={formatHours(calculated.regularHours)} />
            <SummaryRow label="Holiday overtime" value={formatHours(calculated.holidayOvertimeHours)} warning={calculated.holidayOvertimeHours > 0} />
            <SummaryRow label="Over-80 overtime" value={formatHours(calculated.thresholdOvertimeHours)} warning={calculated.thresholdOvertimeHours > 0} />
            <SummaryRow label="Total overtime" value={formatHours(calculated.overtimeHours)} warning={calculated.overtimeHours > 0} />
            <SummaryRow label="Total breaks" value={formatMinutes(calculated.totalBreakMinutes)} />
            <SummaryRow label="Completed days" value={`${calculated.completedDays}/14`} />
          </div>
        </aside>
      </div>
    </main>
  )
}

function DayEditorCard({ day, previousDay, disabled, onChange, onCopyPrevious }: { day: TimesheetEditorDay; previousDay: TimesheetEditorDay | null; disabled: boolean; onChange: (patch: Partial<TimesheetEditorDay>) => void; onCopyPrevious: () => void }) {
  const result = safeCalculateDay(toCalculationInput(day))
  const overrideValue = day.holidayOverride === null ? "default" : day.holidayOverride ? "holiday" : "regular"
  return (
    <article className={cn("rounded-lg border bg-card p-4", result.status === "INCOMPLETE" && "border-warning/30 bg-warning/5", day.isHoliday && "border-primary/25 bg-primary/5", day.isDayOff && "bg-muted/50", result.error && "border-destructive/30")}>
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><p className="font-semibold">{day.dayOfWeek}</p>{day.isHoliday && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><Sparkles className="size-3" />{day.holidayName ?? "Holiday"}</span>}</div><p className="text-xs text-muted-foreground">{formatDate(day.date)}</p></div>
        <div className="text-right"><DayStatusBadge status={result.status} /><p className="mt-1 text-lg font-semibold tabular-nums">{day.isDayOff ? "0.0h" : formatHours(result.workedHours)}</p></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[8rem_8rem_8rem_1fr]">
        <Field label="Start" htmlFor={`${day.id}-start`}><Input id={`${day.id}-start`} type="time" value={day.startTime} disabled={disabled || day.isDayOff} onChange={(event) => onChange({ startTime: event.target.value })} /></Field>
        <Field label="End" htmlFor={`${day.id}-end`}><Input id={`${day.id}-end`} type="time" value={day.endTime} disabled={disabled || day.isDayOff} onChange={(event) => onChange({ endTime: event.target.value })} /></Field>
        <Field label="Break min" htmlFor={`${day.id}-break`}><Input id={`${day.id}-break`} type="number" min={0} step={5} value={day.breakMinutes} disabled={disabled || day.isDayOff} onChange={(event) => onChange({ breakMinutes: Number(event.target.value) || 0 })} /></Field>
        <Field label="Notes" htmlFor={`${day.id}-notes`}><Textarea id={`${day.id}-notes`} value={day.notes} disabled={disabled} rows={2} placeholder="Optional" onChange={(event) => onChange({ notes: event.target.value })} className="min-h-9 md:min-h-9" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {previousDay && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onCopyPrevious}><Copy className="size-3.5" />Copy from {previousDay.dayOfWeek}</Button>}
        <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><input type="checkbox" checked={day.isDayOff} disabled={disabled} onChange={(event) => onChange({ isDayOff: event.target.checked, startTime: event.target.checked ? "" : day.startTime, endTime: event.target.checked ? "" : day.endTime, breakMinutes: event.target.checked ? 0 : day.breakMinutes, holidayOverride: event.target.checked ? false : null, isHoliday: event.target.checked ? false : Boolean(day.holidayName) })} className="size-4 rounded border-input" />Day off</label>
        <div className="grid gap-1"><Label htmlFor={`${day.id}-holiday`} className="text-[11px] uppercase text-muted-foreground">Holiday treatment</Label><select id={`${day.id}-holiday`} value={overrideValue} disabled={disabled || day.isDayOff} onChange={(event) => {
          const value = event.target.value
          onChange(value === "default" ? { holidayOverride: null, isHoliday: Boolean(day.holidayName) } : value === "holiday" ? { holidayOverride: true, isHoliday: true, isDayOff: false } : { holidayOverride: false, isHoliday: false })
        }} className="h-8 rounded-md border border-input bg-background px-2 text-sm"><option value="default">Company default</option><option value="holiday">Force holiday</option><option value="regular">Force regular</option></select></div>
        {result.status === "COMPLETE" && <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" />Complete</span>}
        {result.error && <span className="text-xs font-medium text-destructive">{result.error}</span>}
      </div>
    </article>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) { return <div className="grid gap-1.5"><Label htmlFor={htmlFor} className="text-[11px] uppercase text-muted-foreground">{label}</Label>{children}</div> }
function SummaryRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) { return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className={cn("font-semibold tabular-nums", warning && "text-warning")}>{value}</span></div> }
function toCalculationInput(day: TimesheetEditorDay): TimesheetDayInput { return { id: day.id, date: day.date, dayOfWeek: day.dayOfWeek, startTime: day.startTime || null, endTime: day.endTime || null, breakMinutes: Number(day.breakMinutes) || 0, notes: day.notes, isDayOff: day.isDayOff, isHoliday: day.isHoliday } }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)) }
function formatMinutes(minutes: number) { return minutes < 60 ? `${minutes}m` : `${Math.round((minutes / 60) * 10) / 10}h` }
