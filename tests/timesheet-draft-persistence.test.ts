import assert from "node:assert/strict"
import test from "node:test"

import { alignSubmittedDaysWithStored } from "../lib/timesheet-draft-persistence"

test("second-week values are persisted against their stored dates", () => {
  const storedDays = Array.from({ length: 7 }, (_, index) => ({
    id: `week-2-day-${index}`,
    date: new Date(Date.UTC(2026, 6, 12 + index)),
    dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index],
  }))
  const submittedDays = storedDays.map((day, index) => ({
    id: day.id,
    // Simulate stale client identity fields from week one. Editable values
    // must still be matched by the persisted day ID.
    date: new Date(Date.UTC(2026, 6, 5 + index)).toISOString().slice(0, 10),
    dayOfWeek: "stale",
    startTime: "08:00",
    endTime: "16:00",
  }))

  const aligned = alignSubmittedDaysWithStored(storedDays, submittedDays)

  assert.deepEqual(
    aligned.map(({ date, dayOfWeek, startTime, endTime }) => ({ date, dayOfWeek, startTime, endTime })),
    storedDays.map((day) => ({
      date: day.date.toISOString().slice(0, 10),
      dayOfWeek: day.dayOfWeek,
      startTime: "08:00",
      endTime: "16:00",
    })),
  )
})

test("a draft payload must contain each stored day exactly once", () => {
  const storedDays = [
    { id: "day-1", date: new Date("2026-07-12T00:00:00.000Z"), dayOfWeek: "Sunday" },
    { id: "day-2", date: new Date("2026-07-13T00:00:00.000Z"), dayOfWeek: "Monday" },
  ]

  assert.throws(
    () => alignSubmittedDaysWithStored(storedDays, [{ id: "day-1" }, { id: "day-1" }]),
    /missing from this timesheet/,
  )
  assert.throws(
    () => alignSubmittedDaysWithStored(storedDays, [{ id: "day-1" }, { id: "another-day" }]),
    /do not belong to this timesheet/,
  )
})
