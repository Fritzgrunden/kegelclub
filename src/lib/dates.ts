/** Alle Termine werden in der Vereinszeitzone dargestellt und eingegeben. */
export const TIME_ZONE = "Europe/Berlin";

const dateFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const weekdayFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, weekday: "long" });
const weekdayShortFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, weekday: "short" });
const monthFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "long", year: "numeric" });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 16.10.2026 */
export const formatDate = (d: Date) => dateFmt.format(d);
/** 19:00 */
export const formatTime = (d: Date) => timeFmt.format(d);
/** 16.10.2026, 19:00 Uhr */
export const formatDateTime = (d: Date) => `${formatDate(d)}, ${formatTime(d)} Uhr`;
/** Freitag */
export const formatWeekday = (d: Date) => weekdayFmt.format(d);
export const formatWeekdayShort = (d: Date) => weekdayShortFmt.format(d).replace(".", "");
/** "2026-10" → "Oktober 2026" */
export function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "2026-10-16" → "16.10.2026" (reines Datum ohne Zeitzone) */
export function formatYmd(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function toZonedParts(d: Date): ZonedParts {
  const parts = Object.fromEntries(partsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Datum in Vereinszeitzone als "YYYY-MM-DD" */
export function toYmd(d: Date) {
  const p = toZonedParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Uhrzeit in Vereinszeitzone als "HH:MM" */
export function toHm(d: Date) {
  const p = toZonedParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function offsetMs(utcMs: number) {
  const p = toZonedParts(new Date(utcMs));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(utcMs / 60000) * 60000;
}

/**
 * Wandelt eine lokale Uhrzeit (Europe/Berlin) in einen UTC-Zeitpunkt um – sommerzeitsicher.
 * zonedToUtc("2026-10-16", "19:00") → 2026-10-16T17:00:00Z
 */
export function zonedToUtc(ymd: string, hm: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - offsetMs(guess);
  const corrected = guess - offsetMs(utc);
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

/** Tage-Arithmetik auf reinen Kalenderdaten ("YYYY-MM-DD"). */
export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monate addieren; existiert der Ankertag nicht (31.), wird der Monatsletzte verwendet. */
export function addMonthsYmd(ymd: string, months: number, anchorDay: number) {
  const [y, m] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(anchorDay, lastDay));
  return first.toISOString().slice(0, 10);
}

export function isValidYmd(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Nächster Geburtstag ab `today` als "YYYY-MM-DD" (29.02. → 01.03. in Nicht-Schaltjahren). */
export function nextBirthday(birthday: string, today: string): string {
  const md = birthday.slice(5);
  const year = Number(today.slice(0, 4));
  const forYear = (y: number) => (isValidYmd(`${y}-${md}`) ? `${y}-${md}` : `${y}-03-01`);
  const candidate = forYear(year);
  return candidate < today ? forYear(year + 1) : candidate;
}
