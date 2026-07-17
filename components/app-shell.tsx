import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { CalendarClock, CalendarRange, LayoutDashboard, Users } from "lucide-react"

import { displayName, isManagerRole, type AppUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function AppShell({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  const manager = isManagerRole(user.role)
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      href: manager ? "/timesheets" : `/timesheets/${user.id}`,
      label: manager ? "Timesheets" : "My Timesheet",
      icon: CalendarClock,
    },
    ...(manager
      ? [
          { href: "/settings/invitations", label: "Users", icon: Users },
          { href: "/settings/payroll", label: "Payroll", icon: CalendarRange },
        ]
      : []),
  ]

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
              <span>Timesheet</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium leading-4">{displayName(user)}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <UserButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6 md:hidden">
          {navItems.map((item) => (
            <Link
              key={`${item.href}-${item.label}-mobile`}
              href={item.href}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  )
}
