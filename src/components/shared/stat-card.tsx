import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  href?: string;
}) {
  const card = (
    <Card className="hover:border-foreground/20 gap-2 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-[3px]"
    >
      {card}
    </Link>
  ) : (
    card
  );
}
