"use client";

import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/fields";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { centsToInput, formatEuro } from "@/lib/format";
import { savePenaltyAction } from "@/server/actions/penalties";

interface Props {
  members: { id: string; displayName: string; firstName: string; lastName: string; avatarImageId: string | null }[];
  types: { id: string; name: string; amountCents: number }[];
  events: { id: string; label: string }[];
  defaults: {
    id?: string;
    userId?: string;
    penaltyTypeId?: string | null;
    customLabel?: string | null;
    amountCents?: number | null;
    date: string;
    eventId?: string | null;
    comment?: string | null;
  };
}

const OTHER = "SONSTIGE";

/** Strafe in drei Taps: Mitglied → Strafart → Speichern. */
export function PenaltyForm({ members, types, events, defaults }: Props) {
  const [userId, setUserId] = useState(defaults.userId ?? "");
  const [typeId, setTypeId] = useState<string>(defaults.penaltyTypeId ?? (defaults.customLabel ? OTHER : ""));
  const [amount, setAmount] = useState(defaults.amountCents != null ? centsToInput(defaults.amountCents) : "");
  const editing = Boolean(defaults.id);

  const chooseType = (id: string) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    setAmount(t ? centsToInput(t.amountCents) : "");
  };

  const onSuccess = useCallback(() => setUserId(""), []);

  return (
    <ActionForm action={savePenaltyAction} onSuccess={onSuccess} className="flex flex-col gap-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="penaltyTypeId" value={typeId === OTHER ? "" : typeId} />

      <Field label="1. Wer?" name="userId">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={userId === m.id}
              onClick={() => setUserId(m.id)}
              className={cn(
                "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-sm",
                userId === m.id ? "border-messing bg-messing/15" : "border-eiche bg-theke",
              )}
            >
              <Avatar person={m} size="md" />
              <span className="w-full truncate text-center">{m.displayName}</span>
              {userId === m.id && <Check size={16} className="absolute right-1.5 top-1.5 text-messing" aria-hidden />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="2. Wofür?" name="penaltyTypeId">
        <div className="grid gap-2 sm:grid-cols-2">
          {[...types, { id: OTHER, name: "Sonstige Strafe", amountCents: -1 }].map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={typeId === t.id}
              onClick={() => chooseType(t.id)}
              className={cn(
                "flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 px-4 text-left",
                typeId === t.id ? "border-messing bg-messing/15" : "border-eiche bg-theke",
              )}
            >
              <span className="font-medium">{t.name}</span>
              {t.amountCents >= 0 && <span className="font-display font-bold tabular-nums">{formatEuro(t.amountCents)}</span>}
            </button>
          ))}
        </div>
      </Field>

      {typeId === OTHER && (
        <Field label="Bezeichnung" name="customLabel">
          <Input name="customLabel" defaultValue={defaults.customLabel ?? ""} placeholder="z. B. Kugel fallen lassen" />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Betrag (€)" name="amount" hint={typeId && typeId !== OTHER ? "Aus dem Katalog, änderbar." : undefined}>
          <Input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Datum" name="date">
          <Input name="date" type="date" defaultValue={defaults.date} />
        </Field>
      </div>

      <Field label="Termin (optional)" name="eventId">
        <Select name="eventId" defaultValue={defaults.eventId ?? ""}>
          <option value="">– kein Termin –</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
      </Field>

      <Field label="Kommentar (optional)" name="comment">
        <Textarea name="comment" defaultValue={defaults.comment ?? ""} rows={2} className="min-h-20" />
      </Field>

      <div className={cn("grid gap-3", !editing && "sm:grid-cols-2")}>
        <SubmitButton size="xl" name="intent" value="fertig" className="w-full">{editing ? "Änderungen speichern" : "Strafe eintragen"}</SubmitButton>
        {!editing && (
          <SubmitButton size="xl" variant="secondary" name="intent" value="weitere" className="w-full">Speichern & nächste</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
