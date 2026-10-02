import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shiftMonth } from "@/lib/domain/dates";
import { formatMonth } from "@/lib/format";
import { hrefWith } from "@/lib/list-params";

export function MonthNav({ pathname, params, month }: { pathname: string; params: Record<string, string>; month: string }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" asChild>
        <Link href={hrefWith(pathname, params, { month: shiftMonth(month, -1) })} aria-label="Previous month">
          <ChevronLeft />
        </Link>
      </Button>
      <span className="min-w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
      <Button variant="outline" size="icon" asChild>
        <Link href={hrefWith(pathname, params, { month: shiftMonth(month, 1) })} aria-label="Next month">
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
