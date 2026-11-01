"use client";

import { useCallback, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, SubmitButton } from "@/components/ui/fields";
import { cn } from "@/components/ui/cn";
import type { CashEntryKind } from "@/server/db/schema";
import { saveCashEntryAction } from "@/server/actions/cash";

const KINDS: { kind: CashEntryKind; label: string }[] = [
  { kind: "AUSGABE", label: "Ausgabe" },
  { kind: "EINNAHME", label: "Einnahme" },
];

/** Einnahme oder Ausgabe erfassen; bei Ausgaben optional „hat ein Mitglied ausgelegt“. */
export function CashEntryForm({ members, today }: { members: { id: string; displayName: string }[]; today: string }) {
  const [kind, setKind] = useState<CashEntryKind>("AUSGABE");
  const [paidBy, setPaidBy] = useState("");
  // Stabil halten: ActionForm ruft onSuccess in einem Effect mit dieser Abhängigkeit auf.
  const onSuccess = useCallback(() => setPaidBy(""), []);

  return (
    <ActionForm action={saveCashEntryAction} resetOnSuccess onSuccess={onSuccess} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-eiche bg-bahn/50 p-1" role="radiogroup" aria-label="Art">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cn(
              "min-h-11 rounded-lg text-[15px]",
              kind === k.kind ? (k.kind === "AUSGABE" ? "bg-absage font-semibold text-white" : "bg-zusage font-semibold text-bahn") : "text-kreide-dim",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <Field label="Wofür?" name="description">
          <Input name="description" maxLength={100} placeholder={kind === "AUSGABE" ? "z. B. Runde Bier" : "z. B. Spende"} required />
        </Field>
        <Field label="Betrag (€)" name="amount">
          <Input name="amount" inputMode="decimal" placeholder="0,00" required />
        </Field>
      </div>

      {kind === "AUSGABE" && (
        <Field
          label="Wer hat bezahlt?"
          name="paidByUserId"
          hint={paidBy ? "Geht nicht von der Kasse ab – wird mit den offenen Strafen verrechnet, ein Rest bleibt als Guthaben." : "Das Geld wurde aus der Kasse genommen."}
        >
          <Select name="paidByUserId" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">Aus der Kasse</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName} hat ausgelegt</option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Datum" name="date">
        <Input name="date" type="date" defaultValue={today} />
      </Field>

      <SubmitButton className="w-full">{kind === "AUSGABE" ? "Ausgabe eintragen" : "Einnahme eintragen"}</SubmitButton>
    </ActionForm>
  );
}
