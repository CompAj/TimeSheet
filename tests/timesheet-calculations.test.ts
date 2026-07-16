import assert from "node:assert/strict"
import test from "node:test"

import { addDaysUTC, toISODate } from "../lib/dates"
import {
  calculateDay,
  calculatePayPeriod,
  type TimesheetDayInput,
} from "../lib/timesheet-calculations"

const start = new Date("2026-07-05T00:00:00Z")

function workedDay(index: number, hours: number, isHoliday = false): TimesheetDayInput {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  const endHour = 8 + wholeHours
  return {
    date: toISODate(addDaysUTC(start, index)),
    dayOfWeek: "Day",
    startTime: "08:00",
    endTime: `${String(endHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    breakMinutes: 0,
    notes: null,
    isDayOff: false,
    isHoliday,
  }
}

function offDay(index: number): TimesheetDayInput {
  return {
    date: toISODate(addDaysUTC(start, index)),
    dayOfWeek: "Day",
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    notes: null,
    isDayOff: true,
    isHoliday: false,
  }
}

function period(days: TimesheetDayInput[]) {
  return calculatePayPeriod([
    { days: days.slice(0, 7) },
    { days: days.slice(7, 14) },
  ])
}

test("an unworked holiday is complete with zero credited hours", () => {
  const result = calculateDay({ ...offDay(0), isDayOff: false, isHoliday: true })
  assert.deepEqual(result, { workedHours: 0, status: "HOLIDAY" })
})

test("80 non-holiday hours remain regular", () => {
  const days = Array.from({ length: 14 }, (_, index) => index < 10 ? workedDay(index, 8) : offDay(index))
  const result = period(days)
  assert.equal(result.regularHours, 80)
  assert.equal(result.overtimeHours, 0)
})

test("holiday work is overtime without consuming the 80 regular hours", () => {
  const days = [workedDay(0, 8, true), ...Array.from({ length: 9 }, (_, index) => workedDay(index + 1, 8)), workedDay(10, 4), ...Array.from({ length: 3 }, (_, index) => offDay(index + 11))]
  const result = period(days)
  assert.equal(result.totalWorkedHours, 84)
  assert.equal(result.regularHours, 76)
  assert.equal(result.holidayOvertimeHours, 8)
  assert.equal(result.thresholdOvertimeHours, 0)
  assert.equal(result.overtimeHours, 8)
})

test("holiday and over-80 overtime are added without double-counting", () => {
  const days = [workedDay(0, 8, true), ...Array.from({ length: 10 }, (_, index) => workedDay(index + 1, 8)), workedDay(11, 4), offDay(12), offDay(13)]
  const result = period(days)
  assert.equal(result.totalWorkedHours, 92)
  assert.equal(result.regularHours, 80)
  assert.equal(result.holidayOvertimeHours, 8)
  assert.equal(result.thresholdOvertimeHours, 4)
  assert.equal(result.overtimeHours, 12)
})

test("the second week receives hours that cross the period threshold", () => {
  const firstWeek = [workedDay(0, 10), workedDay(1, 10), workedDay(2, 10), workedDay(3, 10), workedDay(4, 10), workedDay(5, 10), workedDay(6, 10)]
  const secondWeek = [workedDay(7, 15), ...Array.from({ length: 6 }, (_, index) => offDay(index + 8))]
  const result = period([...firstWeek, ...secondWeek])
  assert.equal(result.weeks[0].regularHours, 70)
  assert.equal(result.weeks[1].regularHours, 10)
  assert.equal(result.weeks[1].overtimeHours, 5)
})
