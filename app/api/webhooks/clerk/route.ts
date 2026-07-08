import { verifyWebhook } from "@clerk/nextjs/webhooks"
import type { WebhookEvent } from "@clerk/nextjs/server"
import type { NextRequest } from "next/server"

import { syncClerkUserToAppUser, unlinkClerkUser } from "@/lib/clerk-user-sync"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  let event: WebhookEvent

  try {
    event = await verifyWebhook(request)
  } catch {
    return new Response("Webhook verification failed", { status: 400 })
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data
    const email = user.email_addresses.find(
      (email) => email.id === user.primary_email_address_id,
    ) ?? user.email_addresses.find((email) => email.verification?.status === "verified") ?? user.email_addresses[0]

    const result = await syncClerkUserToAppUser({
      clerkUserId: user.id,
      email: email?.email_address ?? null,
      emailVerified: email?.verification?.status === "verified",
      firstName: user.first_name,
      lastName: user.last_name,
    }, { requireInvite: false })

    if (result.ok) {
      console.info("Clerk webhook synced app user.", {
        eventType: event.type,
        clerkUserId: user.id,
        appUserId: result.user.id,
      })
    } else {
      console.warn("Clerk webhook skipped app user sync.", {
        eventType: event.type,
        clerkUserId: user.id,
        reason: result.reason,
        email: email?.email_address ?? null,
      })
    }

    return Response.json({
      received: true,
      synced: result.ok,
      reason: result.ok ? undefined : result.reason,
    }, { status: result.ok ? 200 : 202 })
  }

  if (event.type === "user.deleted" && event.data.id) {
    await unlinkClerkUser(event.data.id)
  }

  return Response.json({ received: true })
}
