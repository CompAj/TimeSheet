import { SignOutButton } from "@clerk/nextjs"
import { ShieldAlert } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message =
    reason === "unverified-email"
      ? "Your Clerk account needs a verified primary email address before it can be matched to an invitation."
      : "This email address has not been invited to use the timesheet system."

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-xs">
        <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center">
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className={buttonVariants()}>
              Back to sign in
            </button>
          </SignOutButton>
        </div>
      </section>
    </main>
  )
}
