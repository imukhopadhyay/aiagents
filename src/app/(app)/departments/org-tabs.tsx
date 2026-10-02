import Link from "next/link";

import { cn } from "@/lib/utils";

export function OrgTabs({ active }: { active: "departments" | "positions" }) {
  const tabs = [
    { key: "departments", label: "Departments", href: "/departments" },
    { key: "positions", label: "Positions", href: "/departments/positions" },
  ] as const;
  return (
    <div className="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center rounded-lg p-[3px]">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium",
            active === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
