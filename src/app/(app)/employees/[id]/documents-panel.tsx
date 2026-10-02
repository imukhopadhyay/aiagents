"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { labelize } from "@/lib/format";
import { DOCUMENT_CATEGORIES } from "@/lib/validation/employee";

import { deleteDocumentAction, uploadDocumentAction } from "../actions";

export interface DocumentRow {
  id: string;
  name: string;
  category: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadForm({ employeeId }: { employeeId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>("OTHER");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    const data = new FormData();
    data.set("employeeId", employeeId);
    data.set("file", file);
    data.set("category", category);
    if (name.trim()) data.set("name", name.trim());
    startTransition(async () => {
      const result = await uploadDocumentAction(data);
      if (!result.ok) {
        toast.error(result.fieldErrors?.file ?? result.error);
        return;
      }
      toast.success(result.message);
      setName("");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="doc-file">File</Label>
        <Input id="doc-file" ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="doc-category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="doc-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {labelize(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="doc-name">Display name (optional)</Label>
        <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
      </Button>
      <p className="text-muted-foreground text-xs sm:col-span-4">PDF, Word, text or images, up to 10 MB.</p>
    </form>
  );
}

export function DocumentsPanel({
  employeeId,
  documents,
  editable,
}: {
  employeeId: string;
  documents: DocumentRow[];
  editable: boolean;
}) {
  return (
    <div className="grid gap-4">
      {editable && <UploadForm employeeId={employeeId} />}
      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" />
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatSize(d.size)} · {new Date(d.uploadedAt).toLocaleDateString()}
                  {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{labelize(d.category)}</Badge>
              <Button variant="ghost" size="icon" asChild>
                <a href={d.url} target="_blank" rel="noreferrer" aria-label={`Open ${d.name}`}>
                  <Download />
                </a>
              </Button>
              {editable && (
                <ConfirmAction
                  title={`Delete ${d.name}?`}
                  description="The file will be permanently removed."
                  confirmLabel="Delete"
                  destructive
                  action={() => deleteDocumentAction({ id: d.id })}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
