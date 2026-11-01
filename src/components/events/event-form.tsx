"use client";

import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, SubmitButton, Textarea } from "@/components/ui/fields";
import { cn } from "@/components/ui/cn";
import {
  generateOccurrenceDates,
  MONTH_WEEKS,
  monthWeekOf,
  RECURRENCE_OPTIONS,
  WEEKDAY_ORDER,
  WEEKDAYS,
} from "@/lib/recurrence";
import { isValidYmd } from "@/lib/dates";
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

const PREVIEW_COUNT = 4;

/** „Fr, 13.11.2026“ */
function shortDate(ymd: string) {
  const weekday = WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()].slice(0, 2);
  const [y, m, d] = ymd.split("-");
  return `${weekday}, ${d}.${m}.${y}`;
}

export function EventForm({ kind, defaults, isSeries = false }: { kind: EventKind; defaults: EventFormDefaults; isSeries?: boolean }) {
  const editing = Boolean(defaults.id);
  const [recurrence, setRecurrence] = useState<Recurrence>("KEINE");
  const [date, setDate] = useState(defaults.date);
  const suggested = monthWeekOf(isValidYmd(defaults.date) ? defaults.date : "2026-01-01");
  const [monthWeek, setMonthWeek] = useState(suggested.monthWeek);
  const [weekday, setWeekday] = useState(suggested.weekday);
  const [intervalDays, setIntervalDays] = useState(21);
  const [seriesEnd, setSeriesEnd] = useState(defaults.seriesEndDate ?? "");
  const [scope, setScope] = useState<"EINZELN" | "SERIE">("EINZELN");

  const repeating = !editing && recurrence !== "KEINE";
  const monthly = recurrence === "MONATLICH_WOCHENTAG";
  const showSeriesEnd = repeating || (editing && isSeries && scope === "SERIE");

  const chooseRecurrence = (value: Recurrence) => {
    setRecurrence(value);
    // Beim Wechsel auf „Wochentag im Monat“ den Wochentag des gewählten Datums vorschlagen
    if (value === "MONATLICH_WOCHENTAG" && isValidYmd(date)) {
      const s = monthWeekOf(date);
      setMonthWeek(s.monthWeek);
      setWeekday(s.weekday);
    }
  };

  const preview = useMemo(() => {
    if (!repeating || !isValidYmd(date)) return [];
    try {
      return generateOccurrenceDates({
        startDate: date,
        recurrence,
        intervalDays,
        monthWeek,
        weekday,
        endDate: isValidYmd(seriesEnd) ? seriesEnd : null,
      });
    } catch {
      return [];
    }
  }, [repeating, date, recurrence, intervalDays, monthWeek, weekday, seriesEnd]);

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
                className={cn("min-h-14 rounded-xl border px-3 py-2 text-left", scope === value ? "border-messing bg-messing/15" : "border-eiche hover:border-messing/50")}
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

      {!editing && (
        <Field label="Wie oft?" name="recurrence">
          <Select name="recurrence" value={recurrence} onChange={(e) => chooseRecurrence(e.target.value as Recurrence)}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      )}

      {repeating && monthly && (
        <div className="rounded-xl border border-eiche/70 bg-theke-2/40 p-3">
          <p className="mb-2 text-sm font-medium text-kreide-dim">Jeden Monat am</p>
          <div className="grid grid-cols-[6.5rem_1fr] gap-2">
            <Select name="monthWeek" aria-label="Der wievielte" value={monthWeek} onChange={(e) => setMonthWeek(Number(e.target.value))}>
              {MONTH_WEEKS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </Select>
            <Select name="weekday" aria-label="Wochentag" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAY_ORDER.map((d) => (
                <option key={d} value={d}>{WEEKDAYS[d]}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {repeating && recurrence === "INDIVIDUELL" && (
        <Field label="Alle wie viele Tage?" name="intervalDays">
          <Input name="intervalDays" type="number" inputMode="numeric" min={1} max={365} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={editing && isSeries && scope === "SERIE" ? "Datum (unverändert)" : repeating ? (monthly ? "Ab" : "Erster Termin") : "Datum"}
          name="date"
          hint={repeating && monthly ? "Frühestens ab diesem Tag" : undefined}
        >
          <Input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required readOnly={editing && isSeries && scope === "SERIE"} />
        </Field>
        <Field label="Uhrzeit" name="time">
          <Input name="time" type="time" defaultValue={defaults.time} required step={300} />
        </Field>
      </div>

      {showSeriesEnd && (
        <Field label="Serie endet am (optional)" name="seriesEndDate" hint="Ohne Enddatum werden die Termine für die nächsten 12 Monate angelegt.">
          <Input name="seriesEndDate" type="date" value={seriesEnd} onChange={(e) => setSeriesEnd(e.target.value)} />
        </Field>
      )}

      {repeating && (
        <div className="rounded-xl border border-zusage/40 bg-zusage/5 p-3" aria-live="polite">
          {preview.length === 0 ? (
            <p className="text-sm text-absage">Mit diesen Angaben entsteht kein Termin.</p>
          ) : (
            <>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zusage">
                <CalendarCheck size={16} aria-hidden /> {preview.length === 1 ? "1 Termin" : `${preview.length} Termine`} werden angelegt
              </p>
              <ul className="text-sm tabular-nums text-kreide/90">
                {preview.slice(0, PREVIEW_COUNT).map((d) => (
                  <li key={d}>{shortDate(d)}</li>
                ))}
                {preview.length > PREVIEW_COUNT && <li className="text-kreide-dim">… bis {shortDate(preview.at(-1)!)}</li>}
              </ul>
            </>
          )}
        </div>
      )}

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
