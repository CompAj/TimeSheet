"use server"

import { revalidatePath } from "next/cache"

import { requireAppUser, type AppRole } from "@/lib/auth"
import { addDaysUTC } from "@/lib/dates"
import { canAssignRole, canManageWorkspace } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export type InvitationActionState = {
  ok: boolean
  message?: string
  error?: string
}

const ROLES: AppRole[] = ["ADMIN", "MANAGER", "EMPLOYEE"]

export async function createInvitationAction(
  _state: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const currentUser = await requireAppUser()
  if (!canManageWorkspace(currentUser.role)) {
    return { ok: false, error: "Only admins and managers can invite users." }
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const role = String(formData.get("role") ?? "") as AppRole

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." }
  }

  if (!ROLES.includes(role)) {
    return { ok: false, error: "Choose a valid role." }
  }

  if (!canAssignRole(currentUser, role)) {
    return { ok: false, error: "You cannot assign that role." }
  }

  const managerId = role === "EMPLOYEE" ? String(formData.get("managerId") ?? "").trim() || null : null

  const expiresAt = addDaysUTC(new Date(), 14)
  const existingPending = await prisma.invitation.findFirst({
    where: { email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (existingPending) {
    await prisma.invitation.update({
      where: { id: existingPending.id },
      data: {
        role,
        managerId,
        invitedById: currentUser.id,
        expiresAt,
      },
    })
  } else {
    await prisma.invitation.create({
      data: {
        email,
        role,
        managerId,
        invitedById: currentUser.id,
        status: "PENDING",
        expiresAt,
      },
    })
  }

  await prisma.user.updateMany({
    where: { email },
    data: { role, managerId },
  })

  revalidatePath("/settings/invitations")
  return { ok: true, message: `Invitation ready for ${email}.` }
}

export async function revokeInvitationAction(formData: FormData) {
  const currentUser = await requireAppUser()
  if (!canManageWorkspace(currentUser.role)) {
    throw new Error("Only admins and managers can revoke invitations.")
  }

  const id = String(formData.get("id") ?? "")
  if (!id) throw new Error("Invitation id is required.")

  await prisma.invitation.update({
    where: { id },
    data: { status: "REVOKED" },
  })

  revalidatePath("/settings/invitations")
}
