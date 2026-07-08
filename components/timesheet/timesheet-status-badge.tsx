import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileEdit,
  Send,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { statusLabel, type TimesheetStatusValue } from "@/lib/timesheet-calculations"

const STATUS_CONFIG: Record<
  TimesheetStatusValue,
  { variant: "secondary" | "warning" | "success" | "destructive" | "outline"; icon: typeof Clock }
> = {
  NOT_STARTED: { variant: "secondary", icon: CircleDashed },
  DRAFT: { variant: "warning", icon: FileEdit },
  IN_PROGRESS: { variant: "warning", icon: Clock },
  READY_TO_SUBMIT: { variant: "success", icon: CheckCircle2 },
  SUBMITTED: { variant: "success", icon: Send },
  APPROVED: { variant: "success", icon: BadgeCheck },
  NEEDS_REVIEW: { variant: "destructive", icon: AlertTriangle },
}

export function TimesheetStatusBadge({ status }: { status: TimesheetStatusValue }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  )
}
