import type { AppRole } from "@/lib/clerk-user-sync"
import type { TimesheetStatusValue } from "@/lib/timesheet-calculations"

export type PermissionUser = {
  id: string
  role: AppRole
}

export type PermissionTargetUser = {
  id: string
  role: AppRole
}

export function isAdmin(role: AppRole) {
  return role === "ADMIN"
}

export function isManager(role: AppRole) {
  return role === "MANAGER"
}

export function isEmployee(role: AppRole) {
  return role === "EMPLOYEE"
}

export function isManagerRole(role: AppRole) {
  return isAdmin(role) || isManager(role)
}

export function canManageUsers(actor: PermissionUser, target: PermissionTargetUser) {
  if (isAdmin(actor.role)) return true
  if (isManager(actor.role)) return isEmployee(target.role)
  return false
}

export function canAssignRole(actor: PermissionUser, role: AppRole) {
  if (isAdmin(actor.role)) return true
  if (isManager(actor.role)) return role === "EMPLOYEE"
  return false
}

export function canAccessTimesheet(actor: PermissionUser, target: PermissionTargetUser) {
  if (actor.id === target.id) return true
  if (isAdmin(actor.role)) return true
  if (isManager(actor.role)) return true
  return false
}

export function canEditTimesheet(
  actor: PermissionUser,
  target: PermissionTargetUser,
  sheetStatus: TimesheetStatusValue,
) {
  if (isEmployee(actor.role)) return false

  const isLocked = sheetStatus === "SUBMITTED" || sheetStatus === "APPROVED"

  if (isAdmin(actor.role)) return true

  if (isManager(actor.role)) {
    if (actor.id === target.id) {
      return !isLocked
    }
    return isEmployee(target.role)
  }

  return false
}

export function canApproveTimesheet(actor: PermissionUser, target: PermissionTargetUser) {
  if (isAdmin(actor.role)) return true
  if (isManager(actor.role)) return isEmployee(target.role)
  return false
}

export function canResetTimesheet(actor: PermissionUser, target: PermissionTargetUser, sheetStatus: TimesheetStatusValue) {
  if (isEmployee(actor.role)) return false
  if (isAdmin(actor.role)) return sheetStatus !== "SUBMITTED" && sheetStatus !== "APPROVED"
  if (isManager(actor.role)) {
    if (actor.id === target.id) {
      return sheetStatus !== "SUBMITTED" && sheetStatus !== "APPROVED"
    }
    return isEmployee(target.role) && sheetStatus !== "SUBMITTED" && sheetStatus !== "APPROVED"
  }
  return false
}

export function canViewTeamOverview(role: AppRole) {
  return isManagerRole(role)
}

export function canManageWorkspace(role: AppRole) {
  return isManagerRole(role)
}

export function canDeleteUser(actor: PermissionUser, target: PermissionTargetUser) {
  if (!isAdmin(actor.role)) return false
  if (actor.id === target.id) return false
  return true
}
