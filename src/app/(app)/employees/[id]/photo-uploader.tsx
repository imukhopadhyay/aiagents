"use client";

import { useRef, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/shared/person-avatar";

import { uploadPhotoAction } from "../actions";

export function PhotoUploader({
  employeeId,
  name,
  photoUrl,
  editable,
}: {
  employeeId: string;
  name: string;
  photoUrl: string | null;
  editable: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const avatar = <PersonAvatar name={name} photoUrl={photoUrl} className="size-16 text-lg" />;
  if (!editable) return avatar;

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("employeeId", employeeId);
    data.set("file", file);
    startTransition(async () => {
      const result = await uploadPhotoAction(data);
      if (result.ok) toast.success(result.message);
      else toast.error(result.fieldErrors?.file ?? result.error);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className="group focus-visible:ring-ring/50 relative rounded-full outline-none focus-visible:ring-[3px]"
      aria-label="Change photo"
      disabled={pending}
    >
      {avatar}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={onChange}
      />
    </button>
  );
}
