import type { Recurrence } from "@/server/db/schema";
import { addDaysYmd, addMonthsYmd } from "./dates";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  KEINE: "Keine Wiederholung",
  TAEGLICH: "Täglich",
  WOECHENTLICH: "Wöchentlich",
  ZWEIWOECHENTLICH: "Alle 2 Wochen",
  MONATLICH: "Monatlich (gleicher Tag, z. B. jeden 21.)",
  MONATLICH_WOCHENTAG: "Monatlich am gleichen Wochentag",
  INDIVIDUELL: "Individuell (alle X Tage)",
};

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, "0");

/** Der wievielte Wochentag des Monats ein Datum ist; 5 = der letzte (gibt es nicht in jedem Monat). */
export function nthWeekdayOf(ymd: string) {
  const day = Number(ymd.slice(8, 10));
  return { weekday: weekdayOf(ymd), nth: Math.ceil(day / 7) };
}

/** „3. Samstag“ bzw. „letzter Samstag“ */
export function nthWeekdayLabel(ymd: string) {
  const { weekday, nth } = nthWeekdayOf(ymd);
  return `${nth === 5 ? "letzter" : `${nth}.`} ${WEEKDAYS[weekday]}`;
}

/** Bezeichnung einer Serie, z. B. „Monatlich am 3. Samstag“ oder „Alle 10 Tage“. */
export function recurrenceLabel(series: { recurrence: Recurrence; startDate: string; intervalDays?: number | null }) {
  if (series.recurrence === "MONATLICH_WOCHENTAG") return `Monatlich am ${nthWeekdayLabel(series.startDate)}`;
  if (series.recurrence === "INDIVIDUELL") return `Alle ${series.intervalDays} Tage`;
  if (series.recurrence === "MONATLICH") return `Monatlich am ${Number(series.startDate.slice(8, 10))}.`;
  return RECURRENCE_LABELS[series.recurrence];
}

/** Datum des n-ten Wochentags im Monat (n = 5 → letzter). Monat 1–12. */
function nthWeekdayInMonth(year: number, month: number, weekday: number, nth: number) {
  const first = weekdayOf(`${year}-${pad(month)}-01`);
  const firstMatch = 1 + ((weekday - first + 7) % 7);
  const last = daysInMonth(year, month);
  let day = firstMatch + (nth - 1) * 7;
  while (day > last) day -= 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

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

  if (recurrence === "MONATLICH_WOCHENTAG") {
    const { weekday, nth } = nthWeekdayOf(startDate);
    let year = Number(startDate.slice(0, 4));
    let month = Number(startDate.slice(5, 7));
    while (dates.length < MAX_OCCURRENCES) {
      const next = nthWeekdayInMonth(year, month, weekday, nth);
      if (next > until) break;
      if (next >= startDate) dates.push(next);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return dates;
  }

  const anchorDay = Number(startDate.slice(8, 10));
  for (let i = 0; dates.length < MAX_OCCURRENCES; i++) {
    const next = recurrence === "MONATLICH" ? addMonthsYmd(startDate, i, anchorDay) : addDaysYmd(startDate, i * stepDays);
    if (next > until) break;
    dates.push(next);
  }
  return dates;
}
