import { PrismaClient } from "../lib/generated/prisma/client"
import { createPrismaAdapter } from "../lib/prisma-adapter"
import { addDaysUTC, buildWeekDates, endOfWeekUTC } from "../lib/dates"
import {
  calculateDay,
  calculateWeek,
  type TimesheetDayInput,
  type TimesheetStatusValue,
} from "../lib/timesheet-calculations"

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

const weekStart = new Date(Date.UTC(2026, 6, 6))
const inviteExpiry = addDaysUTC(new Date(), 30)

type SeedUser = {
  email: string
  firstName: string
  lastName: string
  role: "ADMIN" | "MANAGER" | "EMPLOYEE"
  managerEmail?: string
}

type SeedDay = Omit<TimesheetDayInput, "date" | "dayOfWeek"> & {
  index: number
}

const users: SeedUser[] = [
  {
    email: "admin@example.com",
    firstName: "Alex",
    lastName: "Admin",
    role: "ADMIN",
  },
  {
    email: "sarah.ahmed@example.com",
    firstName: "Sarah",
    lastName: "Ahmed",
    role: "EMPLOYEE",
    managerEmail: "noah.williams@example.com",
  },
  {
    email: "liam.chen@example.com",
    firstName: "Liam",
    lastName: "Chen",
    role: "EMPLOYEE",
    managerEmail: "noah.williams@example.com",
  },
  {
    email: "ava.patel@example.com",
    firstName: "Ava",
    lastName: "Patel",
    role: "EMPLOYEE",
    managerEmail: "noah.williams@example.com",
  },
  {
    email: "noah.williams@example.com",
    firstName: "Noah",
    lastName: "Williams",
    role: "MANAGER",
  },
  {
    email: "maya.johnson@example.com",
    firstName: "Maya",
    lastName: "Johnson",
    role: "EMPLOYEE",
    managerEmail: "noah.williams@example.com",
  },
  {
    email: "ethan.brown@example.com",
    firstName: "Ethan",
    lastName: "Brown",
    role: "EMPLOYEE",
    managerEmail: "noah.williams@example.com",
  },
]

const samples: Array<{
  email: string
  status?: TimesheetStatusValue
  submittedAt?: Date
  days: SeedDay[]
}> = [
  {
    email: "sarah.ahmed@example.com",
    days: [
      day(0, "09:00", "17:30", 30, "Team standup and inventory"),
      day(1, "09:15", "17:00", 45),
      day(2, "08:30", "17:30", 60, "Vendor delivery"),
      day(3, "09:00", "18:00", 60),
      day(4, "09:00", "16:30", 30, "Left early - approved"),
      emptyDay(5),
      emptyDay(6),
    ],
  },
  {
    email: "liam.chen@example.com",
    days: [
      day(0, "08:00", "17:00", 60),
      day(1, "08:00", "17:30", 60),
      day(2, "08:00", "17:00", 60),
      day(3, "08:00", "17:30", 60),
      day(4, "08:00", "17:30", 60),
      offDay(5),
      offDay(6),
    ],
  },
  {
    email: "ava.patel@example.com",
    days: [
      day(0, "09:00", "17:00", 30),
      day(1, "09:00", "16:30", 30),
      day(2, "09:00", "17:00", 30),
      partialDay(3, "09:00", "", "Forgot to clock out"),
      emptyDay(4),
      emptyDay(5),
      emptyDay(6),
    ],
  },
  {
    email: "noah.williams@example.com",
    status: "SUBMITTED",
    submittedAt: new Date(Date.UTC(2026, 6, 12, 18, 0, 0)),
    days: [
      day(0, "09:00", "17:30", 30),
      day(1, "09:00", "17:30", 30),
      day(2, "09:00", "17:30", 30),
      day(3, "09:00", "17:30", 30),
      day(4, "09:00", "17:30", 30),
      offDay(5),
      offDay(6),
    ],
  },
  {
    email: "maya.johnson@example.com",
    days: [emptyDay(0), emptyDay(1), emptyDay(2), emptyDay(3), emptyDay(4), emptyDay(5), emptyDay(6)],
  },
  {
    email: "ethan.brown@example.com",
    status: "NEEDS_REVIEW",
    submittedAt: new Date(Date.UTC(2026, 6, 12, 17, 30, 0)),
    days: [
      day(0, "08:00", "18:00", 60),
      day(1, "08:00", "18:00", 60),
      day(2, "08:00", "18:00", 60),
      day(3, "08:00", "17:00", 60),
      day(4, "08:00", "17:00", 60),
      day(5, "09:00", "12:00", 0, "Extra shift"),
      offDay(6),
    ],
  },
]

function day(index: number, startTime: string, endTime: string, breakMinutes: number, notes = ""): SeedDay {
  return {
    id: undefined,
    index,
    startTime,
    endTime,
    breakMinutes,
    notes,
    isDayOff: false,
  }
}

function partialDay(index: number, startTime: string, endTime: string, notes = ""): SeedDay {
  return {
    id: undefined,
    index,
    startTime,
    endTime,
    breakMinutes: 0,
    notes,
    isDayOff: false,
  }
}

function offDay(index: number): SeedDay {
  return {
    id: undefined,
    index,
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    notes: null,
    isDayOff: true,
  }
}

function emptyDay(index: number): SeedDay {
  return {
    id: undefined,
    index,
    startTime: null,
    endTime: null,
    breakMinutes: 0,
    notes: null,
    isDayOff: false,
  }
}

async function main() {
  const createdUsers = new Map<string, { id: string }>()

  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      create: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      select: { id: true },
    })
    createdUsers.set(user.email, saved)

    const existingInvite = await prisma.invitation.findFirst({
      where: { email: user.email, status: "PENDING" },
      select: { id: true },
    })

    if (!existingInvite) {
      await prisma.invitation.create({
        data: {
          email: user.email,
          role: user.role,
          status: "PENDING",
          expiresAt: inviteExpiry,
        },
      })
    }
  }

  for (const user of users) {
    if (!user.managerEmail) continue
    const saved = createdUsers.get(user.email)
    const manager = createdUsers.get(user.managerEmail)
    if (!saved || !manager) continue

    await prisma.user.update({
      where: { id: saved.id },
      data: { managerId: manager.id },
    })
  }

  for (const sample of samples) {
    const user = createdUsers.get(sample.email)
    if (!user) continue

    const weekDates = buildWeekDates(weekStart)
    const inputs = sample.days.map((seedDay) => {
      const meta = weekDates[seedDay.index]
      return {
        id: seedDay.id,
        date: meta.date.toISOString().slice(0, 10),
        dayOfWeek: meta.dayName,
        startTime: seedDay.startTime,
        endTime: seedDay.endTime,
        breakMinutes: seedDay.breakMinutes,
        notes: seedDay.notes,
        isDayOff: seedDay.isDayOff,
      } satisfies TimesheetDayInput
    })

    const totals = calculateWeek(inputs, sample.status)
    const status = sample.status ?? totals.status
    const days = inputs.map((input) => {
      const calculated = calculateDay(input)
      return {
        date: new Date(`${input.date}T00:00:00.000Z`),
        dayOfWeek: input.dayOfWeek,
        startTime: input.isDayOff ? null : input.startTime || null,
        endTime: input.isDayOff ? null : input.endTime || null,
        breakMinutes: input.isDayOff ? 0 : input.breakMinutes,
        notes: input.notes?.trim() || null,
        isDayOff: input.isDayOff,
        workedHours: calculated.workedHours,
        status: calculated.status,
      }
    })

    await prisma.weeklyTimesheet.upsert({
      where: {
        userId_weekStartDate: {
          userId: user.id,
          weekStartDate: weekStart,
        },
      },
      update: {
        weekEndDate: endOfWeekUTC(weekStart),
        status,
        completionPercentage: totals.completionPercentage,
        totalWorkedHours: totals.totalWorkedHours,
        totalBreakMinutes: totals.totalBreakMinutes,
        regularHours: totals.regularHours,
        overtimeHours: totals.overtimeHours,
        submittedAt: sample.submittedAt ?? null,
        approvedAt: null,
        days: {
          deleteMany: {},
          create: days,
        },
      },
      create: {
        userId: user.id,
        weekStartDate: weekStart,
        weekEndDate: endOfWeekUTC(weekStart),
        status,
        completionPercentage: totals.completionPercentage,
        totalWorkedHours: totals.totalWorkedHours,
        totalBreakMinutes: totals.totalBreakMinutes,
        regularHours: totals.regularHours,
        overtimeHours: totals.overtimeHours,
        submittedAt: sample.submittedAt ?? null,
        approvedAt: null,
        days: {
          create: days,
        },
      },
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
