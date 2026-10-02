"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarPlus,
  FileSignature,
  Loader2,
  Pencil,
  Upload,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  type Option,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionForm } from "@/hooks/use-action-form";
import { labelize } from "@/lib/format";
import {
  type CandidateInput,
  INTERVIEW_TYPES,
  interviewSchema,
  offerSchema,
} from "@/lib/validation/recruitment";

import {
  applyToJobAction,
  createOfferAction,
  hireCandidateAction,
  scheduleInterviewAction,
  setOfferStatusAction,
  uploadResumeAction,
} from "../../actions";
import { CandidateForm } from "../candidate-form";

export function ResumeUpload({
  candidateId,
  hasResume,
}: {
  candidateId: string;
  hasResume: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />}{" "}
        {hasResume ? "Replace resume" : "Upload resume"}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.doc,.docx"
        className="sr-only"
        tabIndex={-1}
        aria-label="Resume file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const data = new FormData();
          data.set("candidateId", candidateId);
          data.set("file", file);
          startTransition(async () => {
            const result = await uploadResumeAction(data);
            if (result.ok) toast.success(result.message);
            else toast.error(result.fieldErrors?.file ?? result.error);
            e.target.value = "";
          });
        }}
      />
    </>
  );
}

export function EditCandidateDialog({
  candidate,
}: {
  candidate: Omit<CandidateInput, "tags"> & { id: string; tags: string[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit candidate</DialogTitle>
        </DialogHeader>
        <CandidateForm candidate={candidate} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function ApplyDialog({ candidateId, jobs }: { candidateId: string; jobs: Option[] }) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Briefcase /> Add to job
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to a job</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="job">Job</Label>
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger id="job" className="w-full">
              <SelectValue placeholder={jobs.length ? "Choose a job" : "No other open jobs"} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.value} value={j.value}>
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!jobId || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await applyToJobAction({ candidateId, jobOpeningId: jobId });
                if (!result.ok) return void toast.error(result.error);
                toast.success(result.message);
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleInterviewDialog({
  applicationId,
  employees,
  timezone,
  defaultDate,
}: {
  applicationId: string;
  employees: Option[];
  timezone: string;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: interviewSchema,
    defaultValues: {
      applicationId,
      type: "VIDEO",
      date: defaultDate,
      time: "10:00",
      durationMinutes: 60,
      location: "",
      interviewerIds: [],
    },
    action: scheduleInterviewAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      f.reset();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus /> Schedule interview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>
            Times are in the job location&apos;s time zone ({timezone}). Interviewers are notified.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="type"
                label="Type"
                options={INTERVIEW_TYPES.map((t) => ({
                  value: t,
                  label: t === "HR" ? "HR" : labelize(t),
                }))}
              />
              <TextField
                control={form.control}
                name="durationMinutes"
                label="Duration (minutes)"
                type="number"
                min={15}
                max={480}
                step={15}
              />
              <TextField control={form.control} name="date" label="Date" type="date" />
              <TextField control={form.control} name="time" label="Time" type="time" />
            </div>
            <TextField control={form.control} name="location" label="Room or meeting link" />
            <FormField
              control={form.control}
              name="interviewerIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interviewers</FormLabel>
                  <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                    {employees.map((e) => {
                      const value = (field.value ?? []) as string[];
                      return (
                        <label key={e.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={value.includes(e.value)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked ? [...value, e.value] : value.filter((v) => v !== e.value),
                              )
                            }
                          />
                          {e.label}
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Schedule</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function OfferDialog({
  applicationId,
  defaultStartDate,
  defaultExpiry,
}: {
  applicationId: string;
  defaultStartDate: string;
  defaultExpiry: string;
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: offerSchema,
    defaultValues: {
      applicationId,
      salary: Number.NaN,
      currency: "USD",
      startDate: defaultStartDate,
      expiresAt: defaultExpiry,
      notes: "",
    },
    action: createOfferAction,
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSignature /> Make offer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Draft an offer</DialogTitle>
          <DialogDescription>Moves the application to the offer stage.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
              <TextField
                control={form.control}
                name="salary"
                label="Annual salary"
                type="number"
                min={0}
                step={1000}
              />
              <TextField control={form.control} name="currency" label="Currency" maxLength={3} />
              <TextField control={form.control} name="startDate" label="Start date" type="date" />
              <TextField
                control={form.control}
                name="expiresAt"
                label="Offer expires"
                type="date"
              />
            </div>
            <TextareaField control={form.control} name="notes" label="Notes" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Save offer</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const OFFER_NEXT: Record<
  string,
  {
    label: string;
    to: "SENT" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "EXPIRED";
    variant?: "outline";
  }[]
> = {
  DRAFT: [
    { label: "Mark sent", to: "SENT" },
    { label: "Withdraw", to: "WITHDRAWN", variant: "outline" },
  ],
  SENT: [
    { label: "Accepted", to: "ACCEPTED" },
    { label: "Declined", to: "DECLINED", variant: "outline" },
    { label: "Withdraw", to: "WITHDRAWN", variant: "outline" },
  ],
};

export function OfferStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {(OFFER_NEXT[status] ?? []).map((a) => (
        <Button
          key={a.to}
          size="sm"
          variant={a.variant}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setOfferStatusAction({ id, status: a.to });
              if (result.ok) toast.success(result.message);
              else toast.error(result.error);
            })
          }
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export function HireDialog({
  applicationId,
  name,
  email,
}: {
  applicationId: string;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserCheck /> Hire
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hire {name}?</DialogTitle>
          <DialogDescription>
            Creates an employee record on probation using the job&apos;s department, position,
            location and hiring manager, starting on the offer&apos;s start date.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={createAccount} onCheckedChange={(v) => setCreateAccount(v === true)} />
          Create a sign-in account and email an invitation to {email}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await hireCandidateAction({ applicationId, createAccount });
                if (!result.ok) return void toast.error(result.error);
                toast.success(result.message);
                setOpen(false);
                router.push(`/employees/${result.data.id}`);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
