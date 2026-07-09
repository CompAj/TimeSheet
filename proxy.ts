import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
})

export const config = {
  matcher: [
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|webp|ico|woff2?|ttf)).*)",
  ],
}
