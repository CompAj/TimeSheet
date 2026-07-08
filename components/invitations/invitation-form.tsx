"use client"

import { useActionState, useEffect } from "react"
import { MailPlus } from "lucide-react"

import { createInvitationAction, type InvitationActionState } from "@/app/actions/invitations"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: InvitationActionState = { ok: false }

export function InvitationForm() {
  const { success, error } = useToast()
  const [state, action, pending] = useActionState(createInvitationAction, initialState)

  useEffect(() => {
    if (!state.message && !state.error) return
    if (state.ok && state.message) {
      success(state.message)
      return
    }
    if (state.error) {
      error(state.error)
    }
  }, [state, success, error])

  return (
    <form action={action} className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_12rem_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" placeholder="employee@example.com" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="EMPLOYEE"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          <MailPlus className="size-4" />
          Invite
        </Button>
      </div>
    </form>
  )
}
