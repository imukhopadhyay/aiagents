"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, visibleNav } from "@/lib/navigation";
import type { PermissionGrants } from "@/lib/rbac/authorize";
import { cn } from "@/lib/utils";

export function NavLinks({
  permissions,
  onNavigate,
}: {
  permissions: PermissionGrants;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = visibleNav(permissions);

  return (
    <nav className="grid gap-6" aria-label="Main">
      {sections.map((section) => (
        <div key={section.title} className="grid gap-1">
          <p className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
