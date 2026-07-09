import "server-only"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { syncClerkUserToAppUser, type AppRole, type AppUser } from "@/lib/clerk-user-sync"
import { canAccessTimesheet, canManageWorkspace } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export type { AppRole, AppUser } from "@/lib/clerk-user-sync"
export { isManagerRole } from "@/lib/permissions"

export function displayName(user: Pick<AppUser, "firstName" | "lastName" | "email">) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return name || user.email || "Unknown user"
}

export async function requireAppUser(): Promise<AppUser> {
  const session = await auth.protect()
  const clerkUserId = session.userId
  if (!clerkUserId) {
    redirect("/sign-in")
  }

  const clerkUser = await currentUser()
  if (!clerkUser) {
    redirect("/sign-in")
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  )

  const syncResult = await syncClerkUserToAppUser({
    clerkUserId,
    email: primaryEmail?.emailAddress ?? null,
    emailVerified: primaryEmail?.verification?.status === "verified",
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
  })

  if (!syncResult.ok) {
    if (syncResult.reason === "unverified-email") {
      redirect("/access-denied?reason=unverified-email")
    }
    if (syncResult.reason === "email-linked") {
      redirect("/access-denied?reason=email-linked")
    }
    redirect("/access-denied")
  }

  return syncResult.user
}

export async function requireManagerUser() {
  const user = await requireAppUser()
  if (!canManageWorkspace(user.role)) {
    redirect("/dashboard")
  }
  return user
}

export async function assertCanAccessTimesheet(currentUser: AppUser, targetUserId: string) {
  if (currentUser.id === targetUserId) return

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  })

  if (!target) {
    throw new Error("Employee not found.")
  }

  if (!canAccessTimesheet(currentUser, target)) {
    throw new Error("You do not have access to this timesheet.")
  }
}
