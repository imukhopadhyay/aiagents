import Link from "next/link";
import { Building2 } from "lucide-react";

export function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
        <Building2 className="size-4" />
      </span>
      HR Suite
    </Link>
  );
}
