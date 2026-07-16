import assert from "node:assert/strict"
import test from "node:test"

import {
  endOfPayPeriodUTC,
  resolvePayPeriodStart,
  startOfWeekUTC,
  toISODate,
} from "../lib/dates"

test("Sunday is the beginning of a payroll week", () => {
  assert.equal(toISODate(startOfWeekUTC(new Date("2026-07-15T12:00:00Z"))), "2026-07-12")
  assert.equal(toISODate(startOfWeekUTC(new Date("2026-07-12T12:00:00Z"))), "2026-07-12")
})

test("a selected date resolves to its fixed 14-day period", () => {
  const anchor = new Date("2026-07-05T00:00:00Z")
  const start = resolvePayPeriodStart(new Date("2026-07-15T00:00:00Z"), anchor)
  assert.equal(toISODate(start), "2026-07-05")
  assert.equal(toISODate(endOfPayPeriodUTC(start)), "2026-07-18")
})

test("period resolution works before the anchor", () => {
  const anchor = new Date("2026-07-05T00:00:00Z")
  assert.equal(toISODate(resolvePayPeriodStart(new Date("2026-07-04T00:00:00Z"), anchor)), "2026-06-21")
})
