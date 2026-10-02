import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Mail, Pencil } from "lucide-react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { DetailList } from "@/components/shared/detail-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, fullName, labelize } from "@/lib/format";
import { can } from "@/lib/rbac/authorize";
import { orgOptions } from "@/lib/services/org";
import { fileUrl } from "@/lib/storage";

import { archiveEmployeeAction, resendInviteAction } from "../actions";
import { DocumentsPanel } from "./documents-panel";
import { EmergencyContacts } from "./emergency-contacts";
import { OffboardDialog } from "./offboard-dialog";
import { PhotoUploader } from "./photo-uploader";
import { ProfileDialog } from "./profile-dialog";

export const metadata: Metadata = { title: "Employee" };

function describeChange(entry: { action: string; entity: string; changes: unknown }): string {
  const c = (entry.changes ?? {}) as Record<string, unknown>;
  if (entry.entity === "EmployeeDocument") {
    return `${entry.action === "DELETE" ? "Deleted" : "Uploaded"} document “${String(c.document ?? "")}”`;
  }
  if (entry.entity === "EmergencyContact") {
    return `${entry.action === "DELETE" ? "Removed" : "Saved"} emergency contact ${String(c.name ?? "")}`;
  }
  if (entry.action === "CREATE") return c.imported ? "Imported from CSV" : "Record created";
  if (entry.action === "DELETE") return "Record archived";
  if (c.offboarded) return `Offboarded (last day ${String(c.terminationDate)})`;
  if (c.photo) return "Photo updated";
  const after = (c.after ?? {}) as Record<string, unknown>;
  const fields = Object.keys(after);
  return fields.length
    ? `Updated ${fields
        .map((f) => labelize(f.replace(/([A-Z])/g, "_$1")))
        .join(", ")
        .toLowerCase()}`
    : "Updated";
}

export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const user = await requirePermission("employee:read", { employeeId: id });

  const employee = await db.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { title: true } },
      location: { select: { name: true, timezone: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      directReports: {
        where: { deletedAt: null, employmentStatus: { not: "TERMINATED" } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { lastName: "asc" },
      },
      user: { select: { id: true, isActive: true, passwordHash: true, lastLoginAt: true } },
      emergencyContacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!employee) notFound();

  const name = fullName(employee);
  const terminated = employee.employmentStatus === "TERMINATED";
  const canEdit = !terminated && can(user, "employee:update", { employeeId: id });
  const canEditProfile =
    !terminated && (canEdit || can(user, "profile:update", { employeeId: id }));
  const canOffboard = can(user, "employee:delete", { employeeId: id });
  const canSeeHistory = can(user, "audit:read") || canEdit;
  const pendingInvite = employee.user && !employee.user.passwordHash && employee.user.isActive;

  const history = canSeeHistory
    ? await db.auditLog.findMany({
        where: {
          entityId: id,
          entity: { in: ["Employee", "EmployeeDocument", "EmergencyContact"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { name: true, email: true } } },
      })
    : [];
  const offboardOptions = canOffboard && !terminated ? (await orgOptions()).employees : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <PhotoUploader
            employeeId={id}
            name={name}
            photoUrl={employee.photoUrl}
            editable={canEditProfile}
          />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {name} <StatusBadge status={employee.employmentStatus} />
            </h1>
            <p className="text-muted-foreground">
              {[employee.position?.title, employee.department?.name].filter(Boolean).join(" · ") ||
                "No position"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingInvite && canEdit && (
            <ConfirmAction
              title="Resend invitation?"
              description={`${employee.workEmail} will receive a new link to set their password.`}
              confirmLabel="Send"
              action={resendInviteAction.bind(null, { id })}
              trigger={
                <Button variant="outline">
                  <Mail /> Resend invite
                </Button>
              }
            />
          )}
          {canEdit ? (
            <Button asChild>
              <Link href={`/employees/${id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          ) : (
            canEditProfile && (
              <ProfileDialog
                profile={{
                  id,
                  phone: employee.phone,
                  personalEmail: employee.personalEmail,
                  address: employee.address,
                }}
              />
            )
          )}
          {canOffboard && !terminated && (
            <OffboardDialog
              employeeId={id}
              name={name}
              reportCount={employee.directReports.length}
              managerName={employee.manager ? fullName(employee.manager) : null}
              employees={offboardOptions}
            />
          )}
          {canOffboard && terminated && (
            <ConfirmAction
              title={`Archive ${name}'s record?`}
              description="The record will be hidden from the directory. History is kept in the audit log."
              confirmLabel="Archive"
              destructive
              action={archiveEmployeeAction.bind(null, { id })}
              redirectTo="/employees"
              trigger={
                <Button variant="outline">
                  <Archive /> Archive record
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Emergency contacts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {canSeeHistory && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Job</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "Employee number", value: employee.employeeNumber },
                  { label: "Work email", value: employee.workEmail },
                  { label: "Position", value: employee.position?.title },
                  {
                    label: "Department",
                    value: employee.department ? (
                      <Link
                        className="underline-offset-4 hover:underline"
                        href={`/departments/${employee.department.id}`}
                      >
                        {employee.department.name}
                      </Link>
                    ) : null,
                  },
                  { label: "Location", value: employee.location?.name },
                  {
                    label: "Manager",
                    value: employee.manager ? (
                      can(user, "employee:read", { employeeId: employee.manager.id }) ? (
                        <Link
                          className="underline-offset-4 hover:underline"
                          href={`/employees/${employee.manager.id}`}
                        >
                          {fullName(employee.manager)}
                        </Link>
                      ) : (
                        fullName(employee.manager)
                      )
                    ) : null,
                  },
                  { label: "Employment type", value: labelize(employee.employmentType) },
                  { label: "Hire date", value: formatDate(employee.hireDate) },
                  ...(employee.terminationDate
                    ? [{ label: "Last working day", value: formatDate(employee.terminationDate) }]
                    : []),
                  {
                    label: "Account",
                    value: !employee.user ? (
                      "No sign-in account"
                    ) : !employee.user.isActive ? (
                      <Badge variant="secondary">Deactivated</Badge>
                    ) : pendingInvite ? (
                      <Badge variant="outline">Invitation pending</Badge>
                    ) : (
                      `Last sign-in ${formatDateTime(employee.user.lastLoginAt)}`
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    { label: "Phone", value: employee.phone },
                    { label: "Personal email", value: employee.personalEmail },
                    { label: "Date of birth", value: formatDate(employee.dateOfBirth) },
                    { label: "Address", value: employee.address },
                  ]}
                />
              </CardContent>
            </Card>
            {employee.directReports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Direct reports ({employee.directReports.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {employee.directReports.map((r) => (
                    <Badge key={r.id} variant="secondary" asChild>
                      <Link href={`/employees/${r.id}`}>{fullName(r)}</Link>
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <EmergencyContacts
            employeeId={id}
            contacts={employee.emergencyContacts}
            editable={canEditProfile}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel
            employeeId={id}
            editable={canEdit}
            documents={employee.documents.map((d) => ({
              id: d.id,
              name: d.name,
              category: d.category,
              size: d.size,
              url: fileUrl(d.fileKey),
              uploadedAt: d.createdAt.toISOString(),
              uploadedBy: d.uploadedBy ? fullName(d.uploadedBy) : null,
            }))}
          />
        </TabsContent>

        {canSeeHistory && (
          <TabsContent value="history">
            <Card className="py-0">
              <CardContent className="px-0">
                {history.length === 0 ? (
                  <p className="text-muted-foreground p-6 text-sm">No changes recorded.</p>
                ) : (
                  <ol className="divide-y">
                    {history.map((entry) => (
                      <li key={entry.id} className="grid gap-0.5 px-6 py-3 text-sm">
                        <span className="font-medium">{describeChange(entry)}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDateTime(entry.createdAt)} ·{" "}
                          {entry.actor?.name ?? entry.actor?.email ?? "System"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
