import type { Metadata } from "next";
import { CalendarCheck, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { fromDateKey, todayIn, toDateKey } from "@/lib/domain/dates";
import { formatDate, labelize } from "@/lib/format";

import { deleteHolidayAction, initializeYearAction } from "../../leave/actions";
import { HolidayDialog } from "./holiday-dialog";
import { LeaveTypeDialog } from "./leave-type-dialog";

export const metadata: Metadata = { title: "Leave settings" };

export default async function LeaveSettingsPage() {
  await requirePermission("leave:manage");
  const year = Number(todayIn("UTC").slice(0, 4));
  const [types, holidays, locations] = await Promise.all([
    db.leaveType.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.holiday.findMany({
      where: { date: { gte: fromDateKey(`${year - 1}-01-01`) } },
      orderBy: { date: "asc" },
      include: { location: { select: { name: true } } },
    }),
    db.location.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave settings"
        description="Leave types, accrual policies and public holidays."
      />

      <Card className="py-0">
        <CardHeader className="flex flex-row items-center justify-between pt-6">
          <div>
            <CardTitle>Leave types</CardTitle>
            <CardDescription>
              Monthly accrual earns 1/12 of the allowance each month.
            </CardDescription>
          </div>
          <LeaveTypeDialog
            trigger={
              <Button size="sm">
                <Plus /> New type
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead className="text-right">Days / year</TableHead>
                <TableHead>Accrual</TableHead>
                <TableHead className="text-right">Carry-over</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} className={t.isActive ? undefined : "opacity-60"}>
                  <TableCell className="pl-6">
                    <span className="font-medium">{t.name}</span>{" "}
                    <span className="text-muted-foreground text-xs">{t.code}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(t.annualAllowance) || "—"}
                  </TableCell>
                  <TableCell>
                    {t.accrualPeriod === "NONE" ? "Up front" : labelize(t.accrualPeriod)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(t.maxCarryOver) || "—"}
                  </TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{t.isPaid ? "Paid" : "Unpaid"}</Badge>
                    {!t.requiresApproval && <Badge variant="secondary">Auto-approved</Badge>}
                    {!t.isActive && <Badge variant="outline">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="pr-6">
                    <LeaveTypeDialog
                      type={{
                        id: t.id,
                        name: t.name,
                        code: t.code,
                        description: t.description,
                        annualAllowance: Number(t.annualAllowance),
                        accrualPeriod: t.accrualPeriod,
                        maxCarryOver: Number(t.maxCarryOver),
                        isPaid: t.isPaid,
                        requiresApproval: t.requiresApproval,
                        isActive: t.isActive,
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${t.name}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="py-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pt-6">
            <div>
              <CardTitle>Public holidays</CardTitle>
              <CardDescription>
                Holidays aren&apos;t counted as leave days or absences.
              </CardDescription>
            </div>
            <HolidayDialog
              locations={locationOptions}
              trigger={
                <Button size="sm">
                  <Plus /> Add holiday
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="px-0">
            {holidays.length === 0 ? (
              <p className="text-muted-foreground px-6 pb-6 text-sm">No holidays configured.</p>
            ) : (
              <Table>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="pl-6">{formatDate(h.date)}</TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {h.location?.name ?? "All locations"}
                      </TableCell>
                      <TableCell className="w-24 pr-6">
                        <div className="flex justify-end gap-1">
                          <HolidayDialog
                            locations={locationOptions}
                            holiday={{
                              id: h.id,
                              name: h.name,
                              date: toDateKey(h.date),
                              locationId: h.locationId,
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Edit ${h.name}`}>
                                <Pencil />
                              </Button>
                            }
                          />
                          <ConfirmAction
                            title={`Remove ${h.name}?`}
                            description="Existing leave requests keep their day counts."
                            confirmLabel="Remove"
                            destructive
                            action={deleteHolidayAction.bind(null, { id: h.id })}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Remove ${h.name}`}>
                                <Trash2 />
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start a new leave year</CardTitle>
            <CardDescription>
              Creates balances for every current employee with the full allowance plus capped
              carry-over of unused days. Existing balances aren&apos;t changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[year, year + 1].map((y) => (
              <ConfirmAction
                key={y}
                title={`Set up ${y} balances?`}
                description={`Balances will be created for ${y} using each leave type's current allowance${y > year ? ` and carry-over from ${y - 1}` : ""}.`}
                confirmLabel="Create balances"
                action={initializeYearAction.bind(null, { year: y })}
                trigger={
                  <Button variant="outline">
                    <CalendarCheck /> Set up {y}
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
