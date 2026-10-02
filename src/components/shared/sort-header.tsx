import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { hrefWith } from "@/lib/list-params";

export function SortHeader({
  label,
  column,
  pathname,
  params,
  sort,
  dir,
  className,
}: {
  label: string;
  column: string;
  pathname: string;
  params: Record<string, string>;
  sort: string;
  dir: "asc" | "desc";
  className?: string;
}) {
  const active = sort === column;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={hrefWith(pathname, params, { sort: column, dir: nextDir, page: null })}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {label}
        <Icon className={active ? "size-3.5" : "text-muted-foreground size-3.5"} />
      </Link>
    </TableHead>
  );
}
