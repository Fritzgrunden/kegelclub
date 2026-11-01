import type { Recurrence } from "@/server/db/schema";
import { addDaysYmd, addMonthsYmd } from "./dates";

export const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
/** Montag zuerst – so wie im Kalender */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** Der wievielte im Monat; 5 = der letzte (den gibt es in jedem Monat, einen 5. nicht). */
export const MONTH_WEEKS: { value: number; label: string }[] = [
  { value: 1, label: "1." },
  { value: 2, label: "2." },
  { value: 3, label: "3." },
  { value: 4, label: "4." },
  { value: 5, label: "letzten" },
];

/** Auswahl im Formular – TAEGLICH gibt es technisch noch, ergibt für einen Kegelclub aber keinen Sinn. */
export const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "KEINE", label: "Einmalig" },
  { value: "WOECHENTLICH", label: "Jede Woche" },
  { value: "ZWEIWOECHENTLICH", label: "Alle 2 Wochen" },
  { value: "MONATLICH_WOCHENTAG", label: "Jeden Monat an einem Wochentag (z. B. 2. Freitag)" },
  { value: "MONATLICH", label: "Jeden Monat am gleichen Datum (z. B. am 15.)" },
  { value: "INDIVIDUELL", label: "Alle X Tage" },
];

const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, "0");

/** Wochentag und „der wievielte“ eines Datums – als Vorschlag für die Auswahl im Formular. */
export function monthWeekOf(ymd: string) {
  // Ein 5. Wochentag ist immer auch der letzte
  return { weekday: weekdayOf(ymd), monthWeek: Math.ceil(Number(ymd.slice(8, 10)) / 7) };
}

/** „2. Freitag“ bzw. „letzten Freitag“ */
export function monthWeekLabel(monthWeek: number, weekday: number) {
  return `${MONTH_WEEKS.find((w) => w.value === monthWeek)?.label ?? `${monthWeek}.`} ${WEEKDAYS[weekday]}`;
}

export interface RecurrenceRule {
  startDate: string;
  recurrence: Recurrence;
  intervalDays?: number | null;
  /** Nur MONATLICH_WOCHENTAG: 1–4, 5 = letzter */
  monthWeek?: number | null;
  /** Nur MONATLICH_WOCHENTAG: 0 = Sonntag … 6 = Samstag */
  weekday?: number | null;
  endDate?: string | null;
}

/** Bezeichnung einer Serie, z. B. „Jeden Monat am 2. Freitag“. */
export function recurrenceLabel(rule: Pick<RecurrenceRule, "recurrence" | "startDate" | "intervalDays" | "monthWeek" | "weekday">) {
  switch (rule.recurrence) {
    case "MONATLICH_WOCHENTAG": {
      const fallback = monthWeekOf(rule.startDate);
      return `Jeden Monat am ${monthWeekLabel(rule.monthWeek ?? fallback.monthWeek, rule.weekday ?? fallback.weekday)}`;
    }
    case "MONATLICH":
      return `Jeden Monat am ${Number(rule.startDate.slice(8, 10))}.`;
    case "WOECHENTLICH":
      return `Jeden ${WEEKDAYS[weekdayOf(rule.startDate)]}`;
    case "ZWEIWOECHENTLICH":
      return `Jeden 2. ${WEEKDAYS[weekdayOf(rule.startDate)]}`;
    case "INDIVIDUELL":
      return `Alle ${rule.intervalDays} Tage`;
    case "TAEGLICH":
      return "Täglich";
    default:
      return "Einmalig";
  }
}

/** Datum des n-ten Wochentags im Monat (n = 5 → letzter). Monat 1–12. */
function nthWeekdayInMonth(year: number, month: number, weekday: number, nth: number) {
  const firstMatch = 1 + ((weekday - weekdayOf(`${year}-${pad(month)}-01`) + 7) % 7);
  let day = firstMatch + (nth - 1) * 7;
  while (day > daysInMonth(year, month)) day -= 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Ohne Enddatum werden Termine für diesen Zeitraum im Voraus angelegt. */
export const DEFAULT_HORIZON_DAYS = 365;
/** Schutz vor versehentlich riesigen Serien. */
export const MAX_OCCURRENCES = 400;

/**
 * Erzeugt alle Termindaten ("YYYY-MM-DD") einer Serie. Bei MONATLICH_WOCHENTAG ist `startDate`
 * nur der früheste mögliche Tag – der erste Termin ist der erste passende Wochentag ab dann.
 */
export function generateOccurrenceDates(rule: RecurrenceRule, horizonDays = DEFAULT_HORIZON_DAYS): string[] {
  const { startDate, recurrence } = rule;
  if (recurrence === "KEINE") return [startDate];

  const until = rule.endDate ?? addDaysYmd(startDate, horizonDays);
  if (until < startDate) return [];
  const dates: string[] = [];

  if (recurrence === "MONATLICH_WOCHENTAG") {
    const fallback = monthWeekOf(startDate);
    const weekday = rule.weekday ?? fallback.weekday;
    const nth = rule.monthWeek ?? fallback.monthWeek;
    let year = Number(startDate.slice(0, 4));
    let month = Number(startDate.slice(5, 7));
    while (dates.length < MAX_OCCURRENCES) {
      const next = nthWeekdayInMonth(year, month, weekday, nth);
      if (next > until) break;
      if (next >= startDate) dates.push(next);
      [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
    }
    return dates;
  }

  if (recurrence === "MONATLICH") {
    const anchorDay = Number(startDate.slice(8, 10));
    for (let i = 0; dates.length < MAX_OCCURRENCES; i++) {
      const next = addMonthsYmd(startDate, i, anchorDay);
      if (next > until) break;
      dates.push(next);
    }
    return dates;
  }

  const stepDays = { TAEGLICH: 1, WOECHENTLICH: 7, ZWEIWOECHENTLICH: 14, INDIVIDUELL: rule.intervalDays ?? 0 }[recurrence];
  if (stepDays < 1) throw new Error("Für „Alle X Tage“ bitte ein Intervall von mindestens 1 Tag angeben.");
  for (let i = 0; dates.length < MAX_OCCURRENCES; i++) {
    const next = addDaysYmd(startDate, i * stepDays);
    if (next > until) break;
    dates.push(next);
  }
  return dates;
}
