import "server-only"

import { prisma } from "@/lib/prisma"

export type PayrollConfiguration = {
  configured: boolean
  anchorDate: Date | null
}

export async function getPayrollConfiguration(): Promise<PayrollConfiguration> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { id: "workspace" },
    select: { payPeriodAnchorDate: true },
  })

  return {
    configured: Boolean(settings?.payPeriodAnchorDate),
    anchorDate: settings?.payPeriodAnchorDate ?? null,
  }
}

export async function requirePayrollAnchor() {
  const configuration = await getPayrollConfiguration()
  if (!configuration.anchorDate) {
    throw new Error("Payroll must be configured before timesheets can be used.")
  }
  return configuration.anchorDate
}
