"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportPreview } from "@/lib/services/employees";
import { IMPORT_COLUMNS } from "@/lib/validation/employee";

import { importEmployeesAction, previewImportAction } from "../actions";

const TEMPLATE =
  IMPORT_COLUMNS.join(",") +
  "\r\nJane,Doe,jane.doe@example.com,,ENG-PLAT,SWE,Headquarters,E0005,FULL_TIME,PROBATION,2026-11-02,+1 555 0100,\r\n";

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function formData() {
    const data = new FormData();
    if (file) data.set("file", file);
    return data;
  }

  function check() {
    setError(null);
    setPreview(null);
    startTransition(async () => {
      const result = await previewImportAction(formData());
      if (result.ok) setPreview(result.data);
      else setError(result.fieldErrors?.file ?? result.error);
    });
  }

  function runImport() {
    startTransition(async () => {
      const result = await importEmployeesAction(formData());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      router.push("/employees");
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Prepare your file</CardTitle>
          <CardDescription>
            Use the template columns. Required: first_name, last_name, work_email, hire_date
            (YYYY-MM-DD). Departments and positions are matched by code, locations by name and
            managers by employee number (including rows in the same file). Imported employees
            don&apos;t get sign-in accounts; invite them from their profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
              download="employee-import-template.csv"
            >
              <Download /> Download template
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload and check</CardTitle>
          <CardDescription>
            Nothing is saved until you confirm. If any row has an error, no rows are imported.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:max-w-md">
            <Label htmlFor="csv">CSV file</Label>
            <Input
              id="csv"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
          </div>
          <div>
            <Button onClick={check} disabled={!file || pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload />} Check file
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>3. Review and import</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {preview.errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{preview.errors.length} row error(s)</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {preview.errors.slice(0, 20).map((e) => (
                      <li key={`${e.row}-${e.message}`}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {preview.errors.length > 20 && <li>…and {preview.errors.length - 20} more</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>{preview.valid} row(s) ready to import</AlertTitle>
              </Alert>
            )}
            {preview.rows.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.department ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div>
              <Button
                onClick={runImport}
                disabled={pending || preview.errors.length > 0 || preview.valid === 0}
              >
                {pending && <Loader2 className="animate-spin" />}
                Import {preview.valid} employee{preview.valid === 1 ? "" : "s"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
