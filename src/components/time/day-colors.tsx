/** Cell colors for attendance and leave calendars. */
export const DAY_STATUS_STYLES: Record<string, { cell: string; label: string }> = {
  PRESENT: { cell: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", label: "Present" },
  REMOTE: { cell: "bg-sky-500/15 text-sky-800 dark:text-sky-300", label: "Remote" },
  LATE: { cell: "bg-amber-500/20 text-amber-900 dark:text-amber-300", label: "Late" },
  HALF_DAY: { cell: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300", label: "Half day" },
  ABSENT: { cell: "bg-red-500/15 text-red-800 dark:text-red-300", label: "Absent" },
  ON_LEAVE: { cell: "bg-violet-500/15 text-violet-800 dark:text-violet-300", label: "On leave" },
  HOLIDAY: { cell: "bg-muted text-muted-foreground", label: "Holiday" },
  WEEKEND: { cell: "bg-muted/50 text-muted-foreground", label: "Weekend" },
  FUTURE: { cell: "text-muted-foreground", label: "Upcoming" },
  NONE: { cell: "text-muted-foreground", label: "—" },
};

export function Legend({ statuses }: { statuses: string[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      {statuses.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-sm border ${DAY_STATUS_STYLES[s]?.cell ?? ""}`} />
          {DAY_STATUS_STYLES[s]?.label ?? s}
        </li>
      ))}
    </ul>
  );
}
