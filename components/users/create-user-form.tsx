"use client"

import { useActionState, useEffect, useState } from "react"
import { UserPlus } from "lucide-react"

import { createUserAction, type ManagerOption, type UserActionState } from "@/app/actions/users"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppRole } from "@/lib/auth"

const initialState: UserActionState = { ok: false }

const selectClassName =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function CreateUserForm({
  actorRole,
  managerOptions,
}: {
  actorRole: AppRole
  managerOptions: ManagerOption[]
}) {
  const { success, error } = useToast()
  const [state, action, pending] = useActionState(createUserAction, initialState)
  const [role, setRole] = useState<AppRole>(actorRole === "ADMIN" ? "EMPLOYEE" : "EMPLOYEE")
  const canChooseRole = actorRole === "ADMIN"
  const showManager = role === "EMPLOYEE"

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
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_12rem_12rem_auto] xl:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="create-email">Email (optional)</Label>
          <Input id="create-email" name="email" type="email" placeholder="Add later to invite them to sign in" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="create-first-name">First name</Label>
          <Input id="create-first-name" name="firstName" placeholder="Jane" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="create-last-name">Last name</Label>
          <Input id="create-last-name" name="lastName" placeholder="Doe" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="create-role">Role</Label>
          {canChooseRole ? (
            <select
              id="create-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as AppRole)}
              className={selectClassName}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          ) : (
            <>
              <input type="hidden" name="role" value="EMPLOYEE" />
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                Employee
              </div>
            </>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="create-manager">Manager</Label>
          {showManager ? (
            <select id="create-manager" name="managerId" defaultValue="" className={selectClassName}>
              <option value="">No manager</option>
              {managerOptions.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input type="hidden" name="managerId" value="" />
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                N/A
              </div>
            </>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          <UserPlus className="size-4" />
          Create user
        </Button>
      </div>
    </form>
  )
}
