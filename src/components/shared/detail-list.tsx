import { cn } from "@/lib/utils";

/** Two-column label/value list for detail pages. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid gap-1">
          <dt className="text-muted-foreground text-sm">{item.label}</dt>
          <dd className="text-sm font-medium break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
