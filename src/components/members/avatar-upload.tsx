"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Camera } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { uploadAvatarAction, removeAvatarAction } from "@/server/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/fields";

const MAX_EDGE = 640;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** Verkleinert das Foto im Browser (spart Speicher & mobile Daten). Der Server prüft trotzdem Typ und Größe. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.85));
}

export function AvatarUpload({
  person,
  userId,
}: {
  person: { firstName: string; lastName: string; avatarImageId: string | null };
  userId?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(uploadAvatarAction, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (state?.ok) setPreview(null); }, [state]);

  const onFile = async (file: File | undefined) => {
    setClientError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setClientError("Bitte ein JPG-, PNG- oder WebP-Bild wählen.");
    if (file.size > 15 * 1024 * 1024) return setClientError("Das Bild ist zu groß.");
    let blob: Blob = file;
    try {
      blob = await resize(file);
    } catch {
      /* Fallback: Original hochladen, der Server prüft die Größe */
    }
    setPreview(URL.createObjectURL(blob));
    const fd = new FormData();
    fd.set("avatar", new File([blob], "avatar.jpg", { type: blob.type || file.type }));
    if (userId) fd.set("userId", userId);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vorschau" className="size-28 rounded-full object-cover ring-2 ring-messing" />
        ) : (
          <Avatar person={person} size="xl" />
        )}
        {pending && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"><Spinner /></span>}
      </div>
      <input ref={input} type="file" accept={ACCEPTED.join(",")} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Profilbild auswählen" />
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={pending} onClick={() => input.current?.click()} className={buttonClass("secondary", "md")}>
          <Camera size={18} aria-hidden /> {person.avatarImageId ? "Foto ersetzen" : "Foto hochladen"}
        </button>
        {person.avatarImageId && !preview && (
          <ActionButton
            action={removeAvatarAction}
            fields={userId ? { userId } : {}}
            variant="ghost"
            confirm={{ title: "Profilbild entfernen?", confirmLabel: "Entfernen" }}
          >
            Entfernen
          </ActionButton>
        )}
      </div>
      <p className="text-xs text-kreide-dim">JPG, PNG oder WebP · max. 2 MB</p>
      {(clientError || (state && !state.ok)) && <Alert tone="error">{clientError ?? state?.message}</Alert>}
      {state?.ok && <Alert tone="success">{state.message}</Alert>}
    </div>
  );
}
