import "server-only"

import { prisma } from "@/lib/prisma"

export type AppRole = "ADMIN" | "MANAGER" | "EMPLOYEE"

export type AppUser = {
  id: string
  clerkUserId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  role: AppRole
  managerId: string | null
  createdAt: Date
  updatedAt: Date
}

export type ClerkUserIdentity = {
  clerkUserId: string
  email: string | null
  emailVerified: boolean
  firstName: string | null
  lastName: string | null
}

export type SyncClerkUserResult =
  | { ok: true; user: AppUser }
  | { ok: false; reason: "email-linked" | "not-invited" | "unverified-email" }

export type SyncClerkUserOptions = {
  requireInvite?: boolean
}

export async function syncClerkUserToAppUser(
  identity: ClerkUserIdentity,
  options: SyncClerkUserOptions = {},
): Promise<SyncClerkUserResult> {
  const requireInvite = options.requireInvite ?? true

  if (!identity.email || !identity.emailVerified) {
    return { ok: false, reason: "unverified-email" }
  }

  const email = identity.email.toLowerCase()

  const [invite, existingByClerk, existingEmailOwner] = await Promise.all([
    findValidInvite(email),
    prisma.user.findUnique({
      where: { clerkUserId: identity.clerkUserId },
    }),
    prisma.user.findUnique({
      where: { email },
    }),
  ])

  const existingUser = existingByClerk ?? existingEmailOwner

  if (!invite && requireInvite && !existingUser) {
    await expirePendingInvites(email)
    return { ok: false, reason: "not-invited" }
  }

  if (existingByClerk && existingByClerk.email !== email) {
    if (existingEmailOwner && existingEmailOwner.id !== existingByClerk.id) {
      return { ok: false, reason: "email-linked" }
    }
  }

  if (existingEmailOwner?.clerkUserId && existingEmailOwner.clerkUserId !== identity.clerkUserId) {
    return { ok: false, reason: "email-linked" }
  }

  const role = invite?.role ?? existingByClerk?.role ?? existingEmailOwner?.role ?? "EMPLOYEE"
  const managerId =
    role === "EMPLOYEE"
      ? invite?.managerId ?? existingByClerk?.managerId ?? existingEmailOwner?.managerId ?? null
      : null

  const user = existingByClerk
    ? await prisma.user.update({
        where: { id: existingByClerk.id },
        data: {
          email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          role,
          managerId,
        },
      })
    : await prisma.user.upsert({
        where: { email },
        update: {
          clerkUserId: identity.clerkUserId,
          firstName: identity.firstName,
          lastName: identity.lastName,
          role,
          managerId,
        },
        create: {
          clerkUserId: identity.clerkUserId,
          email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          role,
          managerId,
        },
      })

  if (invite?.status === "PENDING") {
    await prisma.invitation.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    })
  }

  return { ok: true, user: user as AppUser }
}

export async function unlinkClerkUser(clerkUserId: string) {
  await prisma.user.updateMany({
    where: { clerkUserId },
    data: { clerkUserId: null },
  })
}

async function findValidInvite(email: string) {
  const now = new Date()
  return prisma.invitation.findFirst({
    where: {
      email,
      OR: [
        { status: "ACCEPTED" },
        {
          status: "PENDING",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
    },
    orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
  })
}

async function expirePendingInvites(email: string) {
  await prisma.invitation.updateMany({
    where: {
      email,
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  })
}
