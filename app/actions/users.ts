"use server"

import { revalidatePath } from "next/cache"

import { requireAppUser, type AppRole } from "@/lib/auth"
import { addDaysUTC } from "@/lib/dates"
import {
  canAssignRole,
  canDeleteUser,
  canManageUsers,
  canManageWorkspace,
  isAdmin,
} from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export type UserActionState = {
  ok: boolean
  message?: string
  error?: string
}

export type ManagerOption = {
  id: string
  name: string
}

export type WorkspaceUserRow = {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  role: AppRole
  managerId: string | null
  managerName: string | null
  clerkLinked: boolean
  canManage: boolean
  canEditRole: boolean
  canEditManager: boolean
  canEditEmail: boolean
  canDelete: boolean
}

const ROLES: AppRole[] = ["ADMIN", "MANAGER", "EMPLOYEE"]

export async function createUserAction(
  _state: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const currentUser = await requireAppUser()
  if (!canManageWorkspace(currentUser.role)) {
    return { ok: false, error: "Only admins and managers can create users." }
  }

  const email = parseOptionalEmail(formData.get("email"))
  const firstName = String(formData.get("firstName") ?? "").trim() || null
  const lastName = String(formData.get("lastName") ?? "").trim() || null
  const role = String(formData.get("role") ?? "EMPLOYEE") as AppRole
  const managerId = parseOptionalId(formData.get("managerId"))

  if (email === false) {
    return { ok: false, error: "Enter a valid email address." }
  }

  if (!email && !firstName && !lastName) {
    return { ok: false, error: "Enter at least a first name, last name, or email." }
  }

  if (!ROLES.includes(role)) {
    return { ok: false, error: "Choose a valid role." }
  }

  if (!canAssignRole(currentUser, role)) {
    return { ok: false, error: "You cannot assign that role." }
  }

  try {
    const resolvedManagerId = await resolveManagerId(role, managerId)

    if (email) {
      await prisma.user.upsert({
        where: { email },
        update: {
          firstName,
          lastName,
          role,
          managerId: resolvedManagerId,
        },
        create: {
          email,
          firstName,
          lastName,
          role,
          managerId: resolvedManagerId,
        },
      })

      await ensureInvitation({
        email,
        role,
        managerId: resolvedManagerId,
        invitedById: currentUser.id,
      })
    } else {
      await prisma.user.create({
        data: {
          firstName,
          lastName,
          role,
          managerId: resolvedManagerId,
        },
      })
    }

    revalidateUserPaths()
    return {
      ok: true,
      message: email
        ? `User created and invitation ready for ${email}.`
        : "User created without email. Add an email later so they can sign in and view their timesheet.",
    }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

export async function updateUserAction(formData: FormData): Promise<UserActionState> {
  const currentUser = await requireAppUser()
  if (!canManageWorkspace(currentUser.role)) {
    return { ok: false, error: "Only admins and managers can manage users." }
  }

  const userId = String(formData.get("userId") ?? "")
  const role = String(formData.get("role") ?? "") as AppRole
  const managerId = parseOptionalId(formData.get("managerId"))

  if (!userId) {
    return { ok: false, error: "User id is required." }
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, clerkUserId: true, firstName: true, lastName: true },
  })

  if (!target) {
    return { ok: false, error: "User not found." }
  }

  if (!canManageUsers(currentUser, target)) {
    return { ok: false, error: "You cannot manage this user." }
  }

  const nextRole = isAdmin(currentUser.role) && ROLES.includes(role) ? role : target.role

  if (isAdmin(currentUser.role) && role && !ROLES.includes(role)) {
    return { ok: false, error: "Choose a valid role." }
  }

  if (!canAssignRole(currentUser, nextRole)) {
    return { ok: false, error: "You cannot assign that role." }
  }

  try {
    const resolvedManagerId = await resolveManagerId(nextRole, managerId, userId)
    const nextEmail = formData.has("email") ? parseOptionalEmail(formData.get("email")) : undefined

    if (nextEmail === false) {
      return { ok: false, error: "Enter a valid email address." }
    }

    if (nextEmail === null && target.clerkUserId) {
      return { ok: false, error: "Email cannot be removed after the user has signed in." }
    }

    if (nextEmail && nextEmail !== target.email) {
      const existing = await prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      })
      if (existing && existing.id !== userId) {
        return { ok: false, error: "That email is already assigned to another user." }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        managerId: resolvedManagerId,
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
      },
    })

    if (nextEmail && nextEmail !== target.email) {
      await ensureInvitation({
        email: nextEmail,
        role: nextRole,
        managerId: resolvedManagerId,
        invitedById: currentUser.id,
      })
    }

    revalidateUserPaths()
    return { ok: true, message: `Updated ${formatUserLabel(target, nextEmail ?? target.email)}.` }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

export async function getWorkspaceUsers(currentUserId: string, currentUserRole: AppRole): Promise<WorkspaceUserRow[]> {
  const users = await prisma.user.findMany({
    include: { manager: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  })

  const actor = { id: currentUserId, role: currentUserRole }

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as AppRole,
    managerId: user.managerId,
    managerName: user.manager ? formatUserName(user.manager) : null,
    clerkLinked: Boolean(user.clerkUserId),
    canManage: canManageUsers(actor, user),
    canEditRole: isAdmin(currentUserRole) && user.id !== currentUserId,
    canEditManager: canManageUsers(actor, user) && user.role === "EMPLOYEE",
    canEditEmail: canManageUsers(actor, user) && !user.clerkUserId,
    canDelete: canDeleteUser(actor, user),
  }))
}

export async function deleteUserAction(formData: FormData): Promise<UserActionState> {
  const currentUser = await requireAppUser()
  if (!isAdmin(currentUser.role)) {
    return { ok: false, error: "Only admins can delete users." }
  }

  const userId = String(formData.get("userId") ?? "")
  if (!userId) {
    return { ok: false, error: "User id is required." }
  }

  if (userId === currentUser.id) {
    return { ok: false, error: "You cannot delete your own account." }
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  })

  if (!target) {
    return { ok: false, error: "User not found." }
  }

  if (!canDeleteUser(currentUser, target)) {
    return { ok: false, error: "You cannot delete this user." }
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
    if (adminCount <= 1) {
      return { ok: false, error: "Cannot delete the last admin." }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (target.email) {
        await tx.invitation.updateMany({
          where: { email: target.email, status: "PENDING" },
          data: { status: "REVOKED" },
        })
      }
      await tx.user.delete({
        where: { id: userId },
      })
    })

    revalidateUserPaths()
    return { ok: true, message: `Deleted ${formatUserLabel(target, target.email)}.` }
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) }
  }
}

export async function getManagerOptions(): Promise<ManagerOption[]> {
  const managers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  return managers.map((manager) => ({
    id: manager.id,
    name: formatUserName(manager),
  }))
}

function parseOptionalId(value: FormDataEntryValue | null) {
  const id = String(value ?? "").trim()
  return id || null
}

async function resolveManagerId(role: AppRole, managerId: string | null, userId?: string) {
  if (role !== "EMPLOYEE") return null
  if (!managerId) return null
  if (userId && managerId === userId) {
    throw new Error("A user cannot be their own manager.")
  }

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, role: true },
  })

  if (!manager || (manager.role !== "ADMIN" && manager.role !== "MANAGER")) {
    throw new Error("Choose a valid manager.")
  }

  return manager.id
}

function parseOptionalEmail(value: FormDataEntryValue | null): string | null | false | undefined {
  if (value === null) return undefined
  const email = String(value).trim().toLowerCase()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  return email
}

async function ensureInvitation({
  email,
  role,
  managerId,
  invitedById,
}: {
  email: string
  role: AppRole
  managerId: string | null
  invitedById: string
}) {
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
        invitedById,
        expiresAt,
      },
    })
    return
  }

  await prisma.invitation.create({
    data: {
      email,
      role,
      managerId,
      invitedById,
      status: "PENDING",
      expiresAt,
    },
  })
}

function formatUserName(user: { firstName: string | null; lastName: string | null; email: string | null }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return name || user.email || "Unknown user"
}

function formatUserLabel(
  user: { firstName: string | null; lastName: string | null; email: string | null },
  email: string | null,
) {
  return formatUserName({ ...user, email: email ?? user.email })
}

function revalidateUserPaths() {
  revalidatePath("/settings/invitations")
  revalidatePath("/dashboard")
  revalidatePath("/timesheets")
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong."
}
