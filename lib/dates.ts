export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export function dateOnlyUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addDaysUTC(date: Date, days: number) {
  const next = dateOnlyUTC(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function startOfWeekUTC(date = new Date()) {
  const base = dateOnlyUTC(date)
  const day = base.getUTCDay()
  return addDaysUTC(base, -day)
}

export function endOfWeekUTC(weekStart: Date) {
  return addDaysUTC(weekStart, 6)
}

export function parseISODate(value: string | undefined | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function parseWeekStart(value: string | undefined | null) {
  const parsed = parseISODate(value)
  return parsed ? startOfWeekUTC(parsed) : startOfWeekUTC()
}

export function resolvePayPeriodStart(selectedDate: Date, anchorDate: Date) {
  const selected = dateOnlyUTC(selectedDate)
  const anchor = dateOnlyUTC(anchorDate)
  const daysSinceAnchor = Math.floor((selected.getTime() - anchor.getTime()) / 86_400_000)
  const periodOffset = Math.floor(daysSinceAnchor / 14) * 14
  return addDaysUTC(anchor, periodOffset)
}

export function parsePayPeriodSelection(value: string | undefined | null, anchorDate: Date) {
  return resolvePayPeriodStart(parseISODate(value) ?? new Date(), anchorDate)
}

export function endOfPayPeriodUTC(periodStart: Date) {
  return addDaysUTC(periodStart, 13)
}

export function formatPayPeriodRange(periodStart: Date) {
  const start = dateOnlyUTC(periodStart)
  const end = endOfPayPeriodUTC(start)
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  return `${formatter.format(start)} - ${endFormatter.format(end)}`
}

export function toISODate(date: Date) {
  return dateOnlyUTC(date).toISOString().slice(0, 10)
}

export function formatWeekRange(weekStart: Date) {
  const start = dateOnlyUTC(weekStart)
  const end = endOfWeekUTC(start)
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: start.getUTCMonth() === end.getUTCMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
  return `${formatter.format(start)} - ${endFormatter.format(end)}`
}

export function buildWeekDates(weekStart: Date) {
  return DAY_NAMES.map((dayName, index) => ({
    date: addDaysUTC(weekStart, index),
    dayName,
  }))
}
