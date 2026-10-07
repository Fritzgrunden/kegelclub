import type { Recurrence } from "@/server/db/schema";
import { addDaysYmd, addMonthsYmd } from "./dates";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  KEINE: "Keine Wiederholung",
  TAEGLICH: "Täglich",
  WOECHENTLICH: "Wöchentlich",
  ZWEIWOECHENTLICH: "Alle 2 Wochen",
  MONATLICH: "Monatlich",
  INDIVIDUELL: "Individuell (alle X Tage)",
};

/** Ohne Enddatum werden Termine für diesen Zeitraum im Voraus angelegt. */
export const DEFAULT_HORIZON_DAYS = 365;
/** Schutz vor versehentlich riesigen Serien (z. B. täglich über 10 Jahre). */
export const MAX_OCCURRENCES = 400;

export interface RecurrenceRule {
  startDate: string;
  recurrence: Recurrence;
  intervalDays?: number | null;
  endDate?: string | null;
}

/** Erzeugt alle Termindaten ("YYYY-MM-DD") einer Serie. */
export function generateOccurrenceDates(rule: RecurrenceRule, horizonDays = DEFAULT_HORIZON_DAYS): string[] {
  const { startDate, recurrence } = rule;
  if (recurrence === "KEINE") return [startDate];

  const until = rule.endDate ?? addDaysYmd(startDate, horizonDays);
  if (until < startDate) return [];

  const stepDays =
    recurrence === "TAEGLICH" ? 1
    : recurrence === "WOECHENTLICH" ? 7
    : recurrence === "ZWEIWOECHENTLICH" ? 14
    : recurrence === "INDIVIDUELL" ? (rule.intervalDays ?? 0)
    : 0;

  if (recurrence === "INDIVIDUELL" && stepDays < 1) {
    throw new Error("Für individuelle Wiederholung muss ein Intervall von mindestens 1 Tag angegeben werden.");
  }

  const dates: string[] = [];
  const anchorDay = Number(startDate.slice(8, 10));
  for (let i = 0; dates.length < MAX_OCCURRENCES; i++) {
    const next = recurrence === "MONATLICH" ? addMonthsYmd(startDate, i, anchorDay) : addDaysYmd(startDate, i * stepDays);
    if (next > until) break;
    dates.push(next);
  }
  return dates;
}
