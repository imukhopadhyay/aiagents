import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="text-muted-foreground size-10" />
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="text-muted-foreground max-w-md">
        Your role doesn&apos;t include the permission this page needs. If you think this is a
        mistake, contact your HR administrator.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
