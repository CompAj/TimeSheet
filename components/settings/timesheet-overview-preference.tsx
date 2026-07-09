"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateHideSelfFromTimesheetAction } from "@/app/actions/settings"
import { useToast } from "@/components/providers/toast-provider"
import { cn } from "@/lib/utils"

export function TimesheetOverviewPreference({ hideSelf }: { hideSelf: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  function onToggle(nextValue: boolean) {
    startTransition(async () => {
      const result = await updateHideSelfFromTimesheetAction(nextValue)
      if (result.ok) {
        toast.success(result.message ?? "Preference saved.")
        router.refresh()
      } else {
        toast.error(result.error ?? "Could not save preference.")
      }
    })
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timesheet overview</h2>
      <label
        className={cn(
          "mt-3 flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 transition-colors",
          isPending && "opacity-60",
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input accent-primary"
          checked={hideSelf}
          disabled={isPending}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Hide my timesheet from the team overview</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            When enabled, your row will not appear on the timesheets page. You can still edit your own timesheet
            directly from the dashboard.
          </span>
        </span>
      </label>
    </section>
  )
}
