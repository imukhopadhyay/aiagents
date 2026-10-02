"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { TextField, TextareaField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { type ProfileInput, profileSchema } from "@/lib/validation/employee";

import { updateProfileAction } from "../actions";

export function ProfileDialog({ profile }: { profile: ProfileInput }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: profileSchema,
    defaultValues: {
      id: profile.id,
      phone: profile.phone ?? "",
      personalEmail: profile.personalEmail ?? "",
      address: profile.address ?? "",
    },
    action: updateProfileAction,
    onSuccess: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit contact details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact details</DialogTitle>
          <DialogDescription>Keep your personal contact information up to date.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <TextField control={form.control} name="phone" label="Phone" type="tel" />
            <TextField control={form.control} name="personalEmail" label="Personal email" type="email" />
            <TextareaField control={form.control} name="address" label="Address" rows={3} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Save</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
