import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </main>
  )
}
