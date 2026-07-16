import { DAY_NAMES } from "./dates"

export type TimesheetDayStatusValue = "EMPTY" | "INCOMPLETE" | "COMPLETE" | "DAY_OFF" | "HOLIDAY"
export type TimesheetStatusValue =
  | "NOT_STARTED"
  | "DRAFT"
  | "IN_PROGRESS"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "APPROVED"
  | "NEEDS_REVIEW"

export type TimesheetDayInput = {
  id?: string
  date: string
  dayOfWeek: string
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  notes: string | null
  isDayOff: boolean
  isHoliday?: boolean
}

export type CalculatedDay = {
  workedHours: number
  status: TimesheetDayStatusValue
  error?: string
}

export type CalculatedWeek = {
  status: TimesheetStatusValue
  completionPercentage: number
  completedDays: number
  totalWorkedHours: number
  totalBreakMinutes: number
  regularHours: number
  overtimeHours: number
}

export type CalculatedPayPeriod = {
  totalWorkedHours: number
  totalBreakMinutes: number
  regularHours: number
  holidayOvertimeHours: number
  thresholdOvertimeHours: number
  overtimeHours: number
  completedDays: number
  completionPercentage: number
  weeks: CalculatedWeek[]
}

export const STANDARD_PAY_PERIOD_HOURS = 80

export function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatHours(hours: number) {
  return `${hours.toFixed(1)}h`
}

export function statusLabel(status: TimesheetStatusValue) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

const DRAFT_STATUSES: TimesheetStatusValue[] = ["NOT_STARTED", "DRAFT", "IN_PROGRESS", "READY_TO_SUBMIT"]

export function isDraftTimesheetStatus(status: TimesheetStatusValue) {
  return DRAFT_STATUSES.includes(status)
}

export function timesheetActionLabel(
  canEdit: boolean,
  canManage: boolean,
  status: TimesheetStatusValue,
) {
  if (canEdit) {
    return isDraftTimesheetStatus(status) ? "Open Draft" : "Edit"
  }
  if (canManage && status === "SUBMITTED") return "Edit"
  return "View"
}

export function dayStatusLabel(status: TimesheetDayStatusValue) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

export function calculateDay(day: TimesheetDayInput): CalculatedDay {
  const breakMinutes = Number.isFinite(day.breakMinutes) ? day.breakMinutes : 0
  if (breakMinutes < 0) {
    throw new Error(`${day.dayOfWeek}: break duration cannot be negative.`)
  }

  if (day.isDayOff) {
    return { workedHours: 0, status: "DAY_OFF" }
  }

  const startTime = day.startTime || ""
  const endTime = day.endTime || ""
  if (day.isHoliday && !startTime && !endTime) {
    return { workedHours: 0, status: "HOLIDAY" }
  }
  const touched =
    startTime !== "" ||
    endTime !== "" ||
    breakMinutes > 0 ||
    Boolean(day.notes?.trim())

  if (!startTime && !endTime && !touched) {
    return { workedHours: 0, status: "EMPTY" }
  }

  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)

  if (start === null || end === null) {
    return { workedHours: 0, status: "INCOMPLETE" }
  }

  if (end <= start) {
    throw new Error(`${day.dayOfWeek}: end time must be after start time.`)
  }

  const shiftMinutes = end - start
  if (breakMinutes > shiftMinutes) {
    throw new Error(`${day.dayOfWeek}: break duration cannot exceed the shift duration.`)
  }

  return {
    workedHours: Math.round(((shiftMinutes - breakMinutes) / 60) * 100) / 100,
    status: day.isHoliday ? "HOLIDAY" : "COMPLETE",
  }
}

export function safeCalculateDay(day: TimesheetDayInput): CalculatedDay {
  try {
    return calculateDay(day)
  } catch (error) {
    return {
      workedHours: 0,
      status: "INCOMPLETE",
      error: error instanceof Error ? error.message : "Invalid day.",
    }
  }
}

export function calculateWeek(
  days: TimesheetDayInput[],
  currentStatus?: TimesheetStatusValue,
  options: { safe?: boolean } = {},
): CalculatedWeek {
  const calculate = options.safe ? safeCalculateDay : calculateDay
  return summarizeWeek(days, currentStatus, calculate)
}

export function calculatePayPeriod(
  weeks: Array<{ days: TimesheetDayInput[]; currentStatus?: TimesheetStatusValue }>,
  options: { safe?: boolean } = {},
): CalculatedPayPeriod {
  const calculate = options.safe ? safeCalculateDay : calculateDay
  let remainingRegularHours = STANDARD_PAY_PERIOD_HOURS
  let holidayOvertimeHours = 0
  let thresholdOvertimeHours = 0

  const calculatedWeeks = weeks.map(({ days, currentStatus }) => {
    const summary = summarizeWeek(days, currentStatus, calculate)
    let regularHours = 0
    let overtimeHours = 0

    for (const day of days) {
      const calculated = calculate(day)
      if (calculated.status !== "COMPLETE" && calculated.status !== "HOLIDAY") continue

      if (day.isHoliday) {
        holidayOvertimeHours += calculated.workedHours
        overtimeHours += calculated.workedHours
        continue
      }

      const regularForDay = Math.min(remainingRegularHours, calculated.workedHours)
      const overtimeForDay = calculated.workedHours - regularForDay
      regularHours += regularForDay
      overtimeHours += overtimeForDay
      thresholdOvertimeHours += overtimeForDay
      remainingRegularHours -= regularForDay
    }

    return {
      ...summary,
      regularHours: roundHours(regularHours),
      overtimeHours: roundHours(overtimeHours),
    }
  })

  const totals = calculatedWeeks.reduce(
    (result, week) => {
      result.totalWorkedHours += week.totalWorkedHours
      result.totalBreakMinutes += week.totalBreakMinutes
      result.regularHours += week.regularHours
      result.overtimeHours += week.overtimeHours
      result.completedDays += week.completedDays
      return result
    },
    { totalWorkedHours: 0, totalBreakMinutes: 0, regularHours: 0, overtimeHours: 0, completedDays: 0 },
  )

  return {
    totalWorkedHours: roundHours(totals.totalWorkedHours),
    totalBreakMinutes: totals.totalBreakMinutes,
    regularHours: roundHours(totals.regularHours),
    holidayOvertimeHours: roundHours(holidayOvertimeHours),
    thresholdOvertimeHours: roundHours(thresholdOvertimeHours),
    overtimeHours: roundHours(totals.overtimeHours),
    completedDays: totals.completedDays,
    completionPercentage: Math.round((totals.completedDays / 14) * 100),
    weeks: calculatedWeeks,
  }
}

function summarizeWeek(
  days: TimesheetDayInput[],
  currentStatus: TimesheetStatusValue | undefined,
  calculate: (day: TimesheetDayInput) => CalculatedDay,
): CalculatedWeek {
  let completedDays = 0
  let totalWorkedHours = 0
  let totalBreakMinutes = 0
  let hasIncompleteDay = false

  for (const day of days) {
    const calculated = calculate(day)
    if (calculated.status === "COMPLETE" || calculated.status === "DAY_OFF" || calculated.status === "HOLIDAY") {
      completedDays += 1
    }
    if (calculated.status === "INCOMPLETE") {
      hasIncompleteDay = true
    }
    if (calculated.status === "COMPLETE" || calculated.status === "HOLIDAY") {
      totalWorkedHours += calculated.workedHours
      totalBreakMinutes += day.breakMinutes || 0
    }
  }

  totalWorkedHours = Math.round(totalWorkedHours * 100) / 100
  const holidayHours = days.reduce((total, day) => {
    if (!day.isHoliday) return total
    const calculated = calculate(day)
    return total + (calculated.status === "HOLIDAY" ? calculated.workedHours : 0)
  }, 0)
  const regularHours = totalWorkedHours - holidayHours
  const overtimeHours = holidayHours
  const completionPercentage = Math.round((completedDays / DAY_NAMES.length) * 100)

  let status: TimesheetStatusValue
  if (currentStatus === "APPROVED" || currentStatus === "SUBMITTED") {
    status = currentStatus
  } else if (completedDays === 0) {
    status = "NOT_STARTED"
  } else if (completedDays < DAY_NAMES.length) {
    status = hasIncompleteDay ? "IN_PROGRESS" : "DRAFT"
  } else {
    status = "READY_TO_SUBMIT"
  }

  return {
    status,
    completionPercentage,
    completedDays,
    totalWorkedHours,
    totalBreakMinutes,
    regularHours: roundHours(regularHours),
    overtimeHours: roundHours(overtimeHours),
  }
}

export function countCompletedDays(days: TimesheetDayInput[]) {
  return days.filter((day) => {
    const calculated = calculateDay(day)
    return calculated.status === "COMPLETE" || calculated.status === "DAY_OFF" || calculated.status === "HOLIDAY"
  }).length
}

function roundHours(hours: number) {
  return Math.round(hours * 100) / 100
}
