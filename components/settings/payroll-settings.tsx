"use client"

import { useState, useTransition } from "react"
import { CalendarDays, Trash2 } from "lucide-react"

import {
  configurePayrollAction,
  deleteHolidayAction,
  saveHolidayAction,
} from "@/app/actions/settings"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type HolidayItem = { id: string; date: string; name: string }

export function PayrollSettings({ anchorDate, holidays }: { anchorDate: string | null; holidays: HolidayItem[] }) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [anchor, setAnchor] = useState("")
  const [holidayDate, setHolidayDate] = useState("")
  const [holidayName, setHolidayName] = useState("")

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message ?? "Saved.")
        after?.()
      } else {
        toast.error(result.error ?? "Something went wrong.")
      }
    })
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold tracking-tight">Payroll calendar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Payroll periods run Sunday through the second Saturday. The first Sunday is locked after setup.
        </p>
        {anchorDate ? (
          <div className="mt-4 flex items-center gap-3 rounded-md bg-muted p-3">
            <CalendarDays className="size-5 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">First payroll Sunday</p>
              <p className="font-semibold">{formatDate(anchorDate)}</p>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              run(() => configurePayrollAction(anchor))
            }}
          >
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="payroll-anchor">First payroll Sunday</Label>
              <Input id="payroll-anchor" type="date" required value={anchor} onChange={(event) => setAnchor(event.target.value)} />
            </div>
            <Button type="submit" disabled={isPending || !anchor}>Configure payroll</Button>
          </form>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold tracking-tight">Company holidays</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Holiday hours are overtime. Unworked holidays count as complete with zero hours.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            run(
              () => saveHolidayAction({ date: holidayDate, name: holidayName }),
              () => {
                setHolidayDate("")
                setHolidayName("")
              },
            )
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="holiday-date">Date</Label>
            <Input id="holiday-date" type="date" required value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="holiday-name">Holiday name</Label>
            <Input id="holiday-name" required maxLength={100} placeholder="Holiday name" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} />
          </div>
          <Button type="submit" disabled={isPending || !holidayDate || !holidayName.trim()}>Save holiday</Button>
        </form>

        <div className="mt-5 overflow-hidden rounded-md border">
          {holidays.map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between gap-4 border-b px-3 py-2.5 last:border-0">
              <div>
                <p className="font-medium">{holiday.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(holiday.date)}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${holiday.name}`} disabled={isPending} onClick={() => run(() => deleteHolidayAction(holiday.id))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {holidays.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No company holidays configured.</p>}
        </div>
      </section>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`))
}
