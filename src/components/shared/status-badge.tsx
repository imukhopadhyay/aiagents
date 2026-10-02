import { Badge } from "@/components/ui/badge";
import { labelize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const STATUS_TONES: Record<string, Tone> = {
  // employment
  ACTIVE: "success",
  PROBATION: "info",
  ON_LEAVE: "warning",
  SUSPENDED: "danger",
  TERMINATED: "neutral",
  // leave / corrections
  PENDING: "warning",
  MANAGER_APPROVED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  // attendance
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  HALF_DAY: "info",
  REMOTE: "info",
  // jobs
  DRAFT: "neutral",
  OPEN: "success",
  ON_HOLD: "warning",
  CLOSED: "neutral",
  FILLED: "info",
  // applications
  APPLIED: "neutral",
  SCREENING: "info",
  INTERVIEW: "info",
  OFFER: "warning",
  HIRED: "success",
  WITHDRAWN: "neutral",
  // interviews / offers
  SCHEDULED: "info",
  COMPLETED: "success",
  NO_SHOW: "danger",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  EXPIRED: "neutral",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = STATUS_TONES[status] ?? "neutral";
  return (
    <Badge variant="outline" className={cn("border-transparent", TONES[tone], className)}>
      {label ?? labelize(status)}
    </Badge>
  );
}
