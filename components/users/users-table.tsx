"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2 } from "lucide-react"

import { deleteUserAction, updateUserAction, type ManagerOption, type WorkspaceUserRow } from "@/app/actions/users"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function UsersTable({
  users,
  managerOptions,
}: {
  users: WorkspaceUserRow[]
  managerOptions: ManagerOption[]
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        No users yet.
      </div>
    )
  }

  return (
    <section className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-240 text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Manager</th>
            <th className="px-4 py-3 font-medium">Clerk</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} managerOptions={managerOptions} />
          ))}
        </tbody>
      </table>
    </section>
  )
}

function UserRow({
  user,
  managerOptions,
}: {
  user: WorkspaceUserRow
  managerOptions: ManagerOption[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Unknown user"

  function deleteUser() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("userId", user.id)
      const result = await deleteUserAction(formData)
      if (result.ok) {
        toast.success(result.message ?? "User deleted.")
        setDeleteOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Could not delete user.")
      }
    })
  }

  if (!user.canManage) {
    return (
      <tr className="border-b last:border-0">
        <td className="px-4 py-3 font-medium">{name}</td>
        <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
        <td className="px-4 py-3">{user.role}</td>
        <td className="px-4 py-3 text-muted-foreground">{user.managerName ?? "—"}</td>
        <td className="px-4 py-3">{user.clerkLinked ? "Linked" : user.email ? "Pending" : "No email"}</td>
        <td className="px-4 py-3 text-right text-xs text-muted-foreground">View only</td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3 font-medium">{name}</td>
      <td className="px-4 py-3">
        {user.canEditEmail ? (
          <Input
            name="email"
            form={`edit-user-${user.id}`}
            type="email"
            defaultValue={user.email ?? ""}
            placeholder="Add email to invite"
            className="min-w-48"
          />
        ) : (
          <span className="text-muted-foreground">{user.email ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {user.canEditRole ? (
          <select name="role" form={`edit-user-${user.id}`} defaultValue={user.role} className={selectClassName}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        ) : (
          user.role
        )}
      </td>
      <td className="px-4 py-3">
        {user.canEditManager ? (
          <select
            name="managerId"
            form={`edit-user-${user.id}`}
            defaultValue={user.managerId ?? ""}
            className={selectClassName}
          >
            <option value="">No manager</option>
            {managerOptions
              .filter((manager) => manager.id !== user.id)
              .map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
          </select>
        ) : (
          <span className="text-muted-foreground">{user.managerName ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">{user.clerkLinked ? "Linked" : user.email ? "Pending" : "No email"}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <form
            id={`edit-user-${user.id}`}
            action={async (formData) => {
              startTransition(async () => {
                const result = await updateUserAction(formData)
                if (result.ok) {
                  toast.success(result.message ?? "User updated.")
                  router.refresh()
                } else {
                  toast.error(result.error ?? "Could not update user.")
                }
              })
            }}
          >
            <input type="hidden" name="userId" value={user.id} />
            {!user.canEditRole && <input type="hidden" name="role" value={user.role} />}
            <Button type="submit" size="sm" disabled={isPending}>
              <Save className="size-4" />
              Save
            </Button>
          </form>
          {user.canDelete && (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
              <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete user?"
                description={`This will permanently remove ${name}${user.email ? ` (${user.email})` : ""} and all of their timesheets from the workspace. This action cannot be undone.`}
                confirmLabel="Delete user"
                onConfirm={deleteUser}
                loading={isPending}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
