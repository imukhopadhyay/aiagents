"use client";

import Link from "next/link";

import { CheckboxField, type Option, SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { labelize } from "@/lib/format";
import { ROLE_KEYS, type RoleKey } from "@/lib/rbac/permissions";
import {
  type CreateEmployeeInput,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  createEmployeeSchema,
} from "@/lib/validation/employee";

import { createEmployeeAction, updateEmployeeAction } from "./actions";

interface Options {
  departments: Option[];
  positions: Option[];
  locations: Option[];
  employees: Option[];
}

const statusOptions = EMPLOYMENT_STATUSES.filter((s) => s !== "TERMINATED").map((s) => ({ value: s, label: labelize(s) }));
const typeOptions = EMPLOYMENT_TYPES.map((t) => ({ value: t, label: labelize(t) }));

export function EmployeeForm({
  employee,
  options,
  canAssignRoles,
}: {
  employee?: Omit<CreateEmployeeInput, "createAccount" | "roles"> & { id: string };
  options: Options;
  canAssignRoles: boolean;
}) {
  const editing = Boolean(employee);
  const { form, onSubmit, pending } = useActionForm({
    // The update schema has the same fields minus account options; the
    // server validates with the right one.
    schema: createEmployeeSchema,
    defaultValues: {
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      workEmail: employee?.workEmail ?? "",
      personalEmail: employee?.personalEmail ?? "",
      phone: employee?.phone ?? "",
      dateOfBirth: employee?.dateOfBirth ?? "",
      address: employee?.address ?? "",
      employeeNumber: employee?.employeeNumber ?? "",
      departmentId: employee?.departmentId ?? "",
      positionId: employee?.positionId ?? "",
      locationId: employee?.locationId ?? "",
      managerId: employee?.managerId ?? "",
      employmentStatus: employee?.employmentStatus ?? "ACTIVE",
      employmentType: employee?.employmentType ?? "FULL_TIME",
      hireDate: employee?.hireDate ?? new Date().toISOString().slice(0, 10),
      createAccount: true,
      roles: ["EMPLOYEE"],
    },
    action: (values) => {
      if (!employee) return createEmployeeAction(values);
      const { createAccount: _a, roles: _r, ...rest } = values;
      void _a;
      void _r;
      return updateEmployeeAction({ ...rest, id: employee.id });
    },
    redirectTo: (data) => `/employees/${data.id}`,
  });

  const createAccount = form.watch("createAccount");
  const managers = options.employees.filter((o) => o.value !== employee?.id);

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="firstName" label="First name" autoComplete="off" />
            <TextField control={form.control} name="lastName" label="Last name" autoComplete="off" />
            <TextField control={form.control} name="personalEmail" label="Personal email" type="email" />
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <TextField control={form.control} name="dateOfBirth" label="Date of birth" type="date" />
            <TextareaField control={form.control} name="address" label="Address" rows={2} className="sm:col-span-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="workEmail" label="Work email" type="email" />
            <TextField
              control={form.control}
              name="employeeNumber"
              label="Employee number"
              placeholder={editing ? undefined : "Generated automatically"}
            />
            <SelectField control={form.control} name="departmentId" label="Department" noneLabel="None" options={options.departments} />
            <SelectField control={form.control} name="positionId" label="Position" noneLabel="None" options={options.positions} />
            <SelectField control={form.control} name="locationId" label="Location" noneLabel="None" options={options.locations} />
            <SelectField control={form.control} name="managerId" label="Manager" noneLabel="No manager" options={managers} />
            <SelectField control={form.control} name="employmentType" label="Employment type" options={typeOptions} />
            <SelectField control={form.control} name="employmentStatus" label="Status" options={statusOptions} />
            <TextField control={form.control} name="hireDate" label="Hire date" type="date" />
          </CardContent>
        </Card>

        {!editing && (
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Create a sign-in account and email the employee a link to set their password.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CheckboxField control={form.control} name="createAccount" label="Create account and send invitation" />
              {createAccount && canAssignRoles && (
                <FormField
                  control={form.control}
                  name="roles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {ROLE_KEYS.map((role) => {
                          const value = (field.value ?? []) as RoleKey[];
                          return (
                            <label key={role} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={value.includes(role)}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked ? [...value, role] : value.filter((r) => r !== role))
                                }
                              />
                              {labelize(role)}
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href={employee ? `/employees/${employee.id}` : "/employees"}>Cancel</Link>
          </Button>
          <SubmitButton pending={pending}>{editing ? "Save changes" : "Create employee"}</SubmitButton>
        </div>
      </form>
    </Form>
  );
}
