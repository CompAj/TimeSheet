"use server"

import { revalidatePath } from "next/cache"

import { requireAppUser } from "@/lib/auth"
import { isManagerRole } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export type SettingsActionState = {
  ok: boolean
  message?: string
  error?: string
}

export async function updateHideSelfFromTimesheetAction(hide: boolean): Promise<SettingsActionState> {
  const currentUser = await requireAppUser()

  if (!isManagerRole(currentUser.role)) {
    return { ok: false, error: "Only managers and admins can change this setting." }
  }

  try {
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { hideSelfFromTimesheetOverview: hide },
    })

    revalidatePath("/settings/invitations")
    revalidatePath("/timesheets")
    revalidatePath("/dashboard")

    return {
      ok: true,
      message: hide
        ? "Your timesheet is hidden from the team overview."
        : "Your timesheet is visible in the team overview again.",
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." }
  }
}
