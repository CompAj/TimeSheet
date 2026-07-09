import { PrismaClient } from "../lib/generated/prisma/client"
import { createPrismaAdapter } from "../lib/prisma-adapter"
import { addDaysUTC } from "../lib/dates"

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "anjanasinghe@gmail.com").trim().toLowerCase()
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || null
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ADMIN_EMAIL is not a valid email address: ${email}`)
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    },
    create: {
      email,
      role: "ADMIN",
      firstName,
      lastName,
    },
  })

  const expiresAt = addDaysUTC(new Date(), 365)
  const existingInvite = await prisma.invitation.findFirst({
    where: { email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (existingInvite) {
    await prisma.invitation.update({
      where: { id: existingInvite.id },
      data: {
        role: "ADMIN",
        expiresAt,
      },
    })
  } else {
    await prisma.invitation.create({
      data: {
        email,
        role: "ADMIN",
        status: "PENDING",
        expiresAt,
      },
    })
  }

  console.info(`Admin ready for ${email} (user id: ${user.id}).`)
  console.info("Sign in with this email via Clerk to activate the account.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
