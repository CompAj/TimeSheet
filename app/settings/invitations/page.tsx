import { AppShell } from "@/components/app-shell"
import { RevokeInvitationButton } from "@/components/invitations/revoke-invitation-button"
import { CreateUserForm } from "@/components/users/create-user-form"
import { UsersTable } from "@/components/users/users-table"
import { getManagerOptions, getWorkspaceUsers } from "@/app/actions/users"
import { displayName, requireManagerUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const user = await requireManagerUser()
  const [workspaceUsers, managerOptions, invitations] = await Promise.all([
    getWorkspaceUsers(user.id, user.role),
    getManagerOptions(),
    prisma.invitation.findMany({
      where: { status: "PENDING" },
      include: { invitedBy: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <AppShell user={user}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create workspace users, assign managers, and manage pending invitations.
          </p>
        </header>

        <CreateUserForm actorRole={user.role} managerOptions={managerOptions} />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workspace users</h2>
          <UsersTable users={workspaceUsers} managerOptions={managerOptions} />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invitations
          </h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-195 text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Invited by</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invite) => (
                  <tr key={invite.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{invite.email}</td>
                    <td className="px-4 py-3">{invite.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {invite.invitedBy ? displayName(invite.invitedBy) : "Seeded"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(invite.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {invite.expiresAt ? formatDate(invite.expiresAt) : "No expiry"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RevokeInvitationButton invitationId={invite.id} email={invite.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invitations.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">No pending invitations.</div>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  )
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
