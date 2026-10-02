import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Audit log" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function AuditLogPage() {
  await requirePermission("audit:read");

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>The 100 most recent events.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No events yet.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{dateFormat.format(entry.createdAt)}</TableCell>
                <TableCell>{entry.actor?.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={entry.action === "LOGIN_FAILED" ? "destructive" : "secondary"}>
                    {entry.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.entity}
                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.ipAddress ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
