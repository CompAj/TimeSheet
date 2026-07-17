type StoredDayIdentity = {
  id: string
  date: Date
  dayOfWeek: string
}

type SubmittedDayIdentity = {
  id: string
}

/**
 * Matches editable values to the persisted day rows by ID while keeping date
 * and weekday identity server-owned. This prevents a stale client date from
 * causing a valid day update (most visibly in week two) to be skipped.
 */
export function alignSubmittedDaysWithStored<SubmittedDay extends SubmittedDayIdentity>(
  storedDays: StoredDayIdentity[],
  submittedDays: SubmittedDay[],
): Array<SubmittedDay & { date: string; dayOfWeek: string }> {
  const submittedDaysById = new Map(submittedDays.map((day) => [day.id, day]))

  if (
    submittedDaysById.size !== submittedDays.length ||
    submittedDaysById.size !== storedDays.length
  ) {
    throw new Error("One or more days are missing from this timesheet.")
  }

  return storedDays
    .toSorted((a, b) => a.date.getTime() - b.date.getTime())
    .map((storedDay) => {
      const submittedDay = submittedDaysById.get(storedDay.id)
      if (!submittedDay) {
        throw new Error("One or more days do not belong to this timesheet.")
      }

      return {
        ...submittedDay,
        date: storedDay.date.toISOString().slice(0, 10),
        dayOfWeek: storedDay.dayOfWeek,
      }
    })
}
