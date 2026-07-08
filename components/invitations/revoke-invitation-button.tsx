"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"

import { revokeInvitationAction } from "@/app/actions/invitations"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"

export function RevokeInvitationButton({
  invitationId,
  email,
  disabled,
}: {
  invitationId: string
  email: string
  disabled?: boolean
}) {
  const toast = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function revoke() {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set("id", invitationId)
        await revokeInvitationAction(formData)
        toast.success(`Invitation for ${email} was revoked.`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not revoke invitation.")
      }
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={disabled || isPending} onClick={revoke}>
      <RotateCcw className="size-4" />
      Revoke
    </Button>
  )
}
