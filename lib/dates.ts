export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
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
  const diff = day === 0 ? -6 : 1 - day
  return addDaysUTC(base, diff)
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
