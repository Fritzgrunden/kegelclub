"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/fields";
import { cn } from "@/components/ui/cn";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import { EVENT_TYPE_LABELS } from "@/lib/format";
import type { EventKind, EventType, Recurrence } from "@/server/db/schema";
import { saveEventAction } from "@/server/actions/events";

export interface EventFormDefaults {
  id?: string;
  title: string;
  eventType?: EventType | null;
  description?: string | null;
  location?: string | null;
  date: string;
  time: string;
  endDate?: string | null;
  endTime?: string | null;
  seriesEndDate?: string | null;
}

export function EventForm({ kind, defaults, isSeries = false }: { kind: EventKind; defaults: EventFormDefaults; isSeries?: boolean }) {
  const editing = Boolean(defaults.id);
  const [recurrence, setRecurrence] = useState<Recurrence>("KEINE");
  const [scope, setScope] = useState<"EINZELN" | "SERIE">("EINZELN");
  const showSeriesEnd = (!editing && recurrence !== "KEINE") || (editing && isSeries && scope === "SERIE");

  return (
    <ActionForm action={saveEventAction} className="flex flex-col gap-5">
      <input type="hidden" name="kind" value={kind} />
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      {editing && isSeries && (
        <fieldset className="rounded-xl border border-messing/40 bg-messing/5 p-3">
          <legend className="px-1 text-sm font-semibold text-messing-hell">Dieser Termin gehört zu einer Serie</legend>
          <input type="hidden" name="scope" value={scope} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["EINZELN", "Nur diesen Termin ändern", "z. B. verschieben wegen Veranstaltung"],
                ["SERIE", "Alle kommenden Termine", "Titel, Ort, Uhrzeit, Serienende"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={cn(
                  "min-h-14 rounded-xl border px-3 py-2 text-left",
                  scope === value ? "border-messing bg-messing/15" : "border-eiche hover:border-messing/50",
                )}
              >
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-kreide-dim">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Titel" name="title">
        <Input name="title" defaultValue={defaults.title} required maxLength={120} />
      </Field>

      {kind === "EVENT" && (
        <Field label="Art des Events" name="eventType">
          <Select name="eventType" defaultValue={defaults.eventType ?? "SONSTIGES"}>
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={editing && isSeries && scope === "SERIE" ? "Datum (unverändert)" : "Datum"} name="date">
          <Input name="date" type="date" defaultValue={defaults.date} required readOnly={editing && isSeries && scope === "SERIE"} />
        </Field>
        <Field label="Uhrzeit" name="time">
          <Input name="time" type="time" defaultValue={defaults.time} required step={300} />
        </Field>
      </div>

      {kind === "EVENT" && (!isSeries || scope === "EINZELN") && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ende – Datum (optional)" name="endDate" hint="Für mehrtägige Events">
            <Input name="endDate" type="date" defaultValue={defaults.endDate ?? ""} />
          </Field>
          <Field label="Ende – Uhrzeit (optional)" name="endTime">
            <Input name="endTime" type="time" defaultValue={defaults.endTime ?? ""} step={300} />
          </Field>
        </div>
      )}

      <Field label="Ort" name="location">
        <Input name="location" defaultValue={defaults.location ?? ""} placeholder="z. B. Gaststätte Zur Kugel, Bahn 2" />
      </Field>

      <Field label="Beschreibung (optional)" name="description">
        <Textarea name="description" defaultValue={defaults.description ?? ""} rows={4} />
      </Field>

      {!editing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Wiederholung" name="recurrence">
            <Select name="recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          {recurrence === "INDIVIDUELL" && (
            <Field label="Alle wie viele Tage?" name="intervalDays">
              <Input name="intervalDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={21} />
            </Field>
          )}
        </div>
      )}

      {showSeriesEnd && (
        <Field label="Serie endet am (optional)" name="seriesEndDate" hint="Ohne Enddatum werden die Termine für die nächsten 12 Monate angelegt.">
          <Input name="seriesEndDate" type="date" defaultValue={defaults.seriesEndDate ?? ""} />
        </Field>
      )}

      <Field label="Bild (optional)" name="image" hint="JPG, PNG oder WebP, max. 2 MB.">
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-kreide-dim file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-theke-2 file:px-4 file:text-kreide"
        />
      </Field>

      <SubmitButton size="xl" className="w-full">{editing ? "Änderungen speichern" : kind === "KEGELABEND" ? "Kegelabend anlegen" : "Event anlegen"}</SubmitButton>
    </ActionForm>
  );
}
