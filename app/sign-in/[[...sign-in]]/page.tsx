import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </main>
  )
}
