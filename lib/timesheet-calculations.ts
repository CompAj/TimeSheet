import { DAY_NAMES } from "./dates"

export type TimesheetDayStatusValue = "EMPTY" | "INCOMPLETE" | "COMPLETE" | "DAY_OFF"
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

export const STANDARD_WEEK_HOURS = 40

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
    status: "COMPLETE",
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
    if (calculated.status === "COMPLETE" || calculated.status === "DAY_OFF") {
      completedDays += 1
    }
    if (calculated.status === "INCOMPLETE") {
      hasIncompleteDay = true
    }
    if (calculated.status === "COMPLETE") {
      totalWorkedHours += calculated.workedHours
      totalBreakMinutes += day.breakMinutes || 0
    }
  }

  totalWorkedHours = Math.round(totalWorkedHours * 100) / 100
  const regularHours = Math.min(STANDARD_WEEK_HOURS, totalWorkedHours)
  const overtimeHours = Math.max(0, totalWorkedHours - STANDARD_WEEK_HOURS)
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
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
  }
}

export function countCompletedDays(days: TimesheetDayInput[]) {
  return days.filter((day) => {
    const calculated = calculateDay(day)
    return calculated.status === "COMPLETE" || calculated.status === "DAY_OFF"
  }).length
}
