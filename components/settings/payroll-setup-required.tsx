import Link from "next/link"
import { CalendarRange } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export function PayrollSetupRequired({ canConfigure }: { canConfigure: boolean }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-xl border bg-card p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarRange className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Payroll setup required</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {canConfigure
            ? "Choose the first Sunday of a payroll period before entering or reviewing timesheets."
            : "A manager or administrator needs to configure the biweekly payroll calendar before timesheets can be used."}
        </p>
        {canConfigure && (
          <Link href="/settings/payroll" className={`${buttonVariants()} mt-6`}>
            Configure payroll
          </Link>
        )}
      </div>
    </main>
  )
}
