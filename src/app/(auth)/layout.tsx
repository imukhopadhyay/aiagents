import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Building2 className="size-5" />
        </span>
        HR Suite
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
