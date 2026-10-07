import type { EventStatus, EventType, UserStatus } from "@/server/db/schema";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatEuro = (cents: number) => euro.format(cents / 100);

/** "2,50" | "2.50" | "2" | "1.234,50" → Cent-Betrag, sonst null */
export function parseEuroToCents(input: string): number | null {
  let s = input.trim().replace(/[\s€]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export function displayName(p: { firstName: string; lastName: string; nickname?: string | null }) {
  return p.nickname?.trim() ? p.nickname : `${p.firstName} ${p.lastName}`;
}

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

export const initials = (p: { firstName: string; lastName: string }) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  KEGELTOUR: "Kegeltour",
  WEIHNACHTSFEIER: "Weihnachtsfeier",
  SOMMERFEST: "Sommerfest",
  VEREINSFEIER: "Vereinsfeier",
  GEBURTSTAG: "Geburtstagsfeier",
  AUSFLUG: "Ausflug",
  SONSTIGES: "Sonstiges",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  GEPLANT: "Geplant",
  ABGESAGT: "Abgesagt",
  ABGESCHLOSSEN: "Abgeschlossen",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  AUSSTEHEND: "Wartet auf Freischaltung",
  AKTIV: "Aktiv",
  PASSIV: "Passiv",
  INAKTIV: "Gesperrt / ausgetreten",
};
