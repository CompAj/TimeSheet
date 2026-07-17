import { CheckCircle2, Circle, Clock, Moon, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { dayStatusLabel, type TimesheetDayStatusValue } from "@/lib/timesheet-calculations"

const STATUS_CONFIG: Record<
  TimesheetDayStatusValue,
  { variant: "secondary" | "warning" | "success" | "outline"; icon: typeof Clock }
> = {
  EMPTY: { variant: "secondary", icon: Circle },
  INCOMPLETE: { variant: "warning", icon: Clock },
  COMPLETE: { variant: "success", icon: CheckCircle2 },
  DAY_OFF: { variant: "outline", icon: Moon },
  HOLIDAY: { variant: "outline", icon: Sparkles },
}

export function DayStatusBadge({ status }: { status: TimesheetDayStatusValue }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {dayStatusLabel(status)}
    </Badge>
  )
}
