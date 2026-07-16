import { AppShell } from "@/components/app-shell"
import { PayrollSettings } from "@/components/settings/payroll-settings"
import { requireManagerUser } from "@/lib/auth"
import { toISODate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function PayrollSettingsPage() {
  const user = await requireManagerUser()
  const [settings, holidays] = await Promise.all([
    prisma.workspaceSettings.findUnique({ where: { id: "workspace" } }),
    prisma.holiday.findMany({ orderBy: { date: "asc" } }),
  ])

  return (
    <AppShell user={user}>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Payroll Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure the biweekly cutoff and company holiday calendar.</p>
        </header>
        <PayrollSettings
          anchorDate={settings?.payPeriodAnchorDate ? toISODate(settings.payPeriodAnchorDate) : null}
          holidays={holidays.map((holiday) => ({ id: holiday.id, date: toISODate(holiday.date), name: holiday.name }))}
        />
      </main>
    </AppShell>
  )
}
