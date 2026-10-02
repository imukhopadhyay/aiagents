import Link from "next/link";
import { Building2 } from "lucide-react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/rbac/authorize";

// Minimal authenticated frame. The full shell (sidebar, breadcrumbs, mobile
// navigation) arrives in Phase 2.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Building2 className="size-4" />
            </span>
            HR Suite
          </Link>
          <nav className="text-muted-foreground flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            {can(user, "audit:read") && (
              <Link href="/admin/audit" className="hover:text-foreground">
                Audit log
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
