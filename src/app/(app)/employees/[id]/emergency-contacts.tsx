"use client";

import { useState } from "react";
import { Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";

import { CheckboxField, TextField } from "@/components/shared/form-fields";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useActionForm } from "@/hooks/use-action-form";
import { type EmergencyContactInput, emergencyContactSchema } from "@/lib/validation/employee";

import { deleteEmergencyContactAction, saveEmergencyContactAction } from "../actions";

type Contact = EmergencyContactInput & { id: string };

function ContactDialog({
  employeeId,
  contact,
  trigger,
}: {
  employeeId: string;
  contact?: Contact;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useActionForm({
    schema: emergencyContactSchema,
    defaultValues: {
      employeeId,
      id: contact?.id,
      name: contact?.name ?? "",
      relationship: contact?.relationship ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      isPrimary: contact?.isPrimary ?? false,
    },
    action: saveEmergencyContactAction,
    onSuccess: (_d, f) => {
      setOpen(false);
      if (!contact) f.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add emergency contact"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="name" label="Name" />
              <TextField control={form.control} name="relationship" label="Relationship" placeholder="e.g. Partner" />
              <TextField control={form.control} name="phone" label="Phone" type="tel" />
              <TextField control={form.control} name="email" label="Email" type="email" />
            </div>
            <CheckboxField control={form.control} name="isPrimary" label="Primary contact" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton pending={pending}>Save contact</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EmergencyContacts({
  employeeId,
  contacts,
  editable,
}: {
  employeeId: string;
  contacts: Contact[];
  editable: boolean;
}) {
  return (
    <div className="grid gap-4">
      {editable && (
        <div>
          <ContactDialog
            employeeId={employeeId}
            trigger={
              <Button variant="outline">
                <Plus /> Add contact
              </Button>
            }
          />
        </div>
      )}
      {contacts.length === 0 ? (
        <EmptyState icon={Phone} title="No emergency contacts" description="Add someone we can reach in an emergency." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
              <div className="grid gap-0.5 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  {c.name}
                  {c.isPrimary && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="size-3" /> Primary
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground">{c.relationship}</p>
                <p>{c.phone}</p>
                {c.email && <p className="text-muted-foreground">{c.email}</p>}
              </div>
              {editable && (
                <div className="flex gap-1">
                  <ContactDialog
                    employeeId={employeeId}
                    contact={c}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`}>
                        <Pencil />
                      </Button>
                    }
                  />
                  <ConfirmAction
                    title={`Remove ${c.name}?`}
                    description="This emergency contact will be deleted."
                    confirmLabel="Remove"
                    destructive
                    action={() => deleteEmergencyContactAction({ id: c.id })}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
