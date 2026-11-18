import { formatDate, formatTime, formatWeekdayShort } from "./dates";

/** Auswahl für die Zu-/Absagefrist. "" = keine Frist. */
export const RSVP_DEADLINE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Keine Frist" },
  { value: "0", label: "Bis Terminbeginn" },
  { value: "2", label: "Bis 2 Stunden vorher" },
  { value: "6", label: "Bis 6 Stunden vorher" },
  { value: "12", label: "Bis 12 Stunden vorher" },
  { value: "24", label: "Bis 1 Tag vorher" },
  { value: "48", label: "Bis 2 Tage vorher" },
  { value: "72", label: "Bis 3 Tage vorher" },
  { value: "168", label: "Bis 1 Woche vorher" },
];

export const MAX_RSVP_DEADLINE_HOURS = 24 * 30;

/** Ende der Zu-/Absagefrist oder null, wenn der Termin keine Frist hat. */
export function rsvpDeadline(event: { startsAt: Date; rsvpDeadlineHours: number | null }): Date | null {
  if (event.rsvpDeadlineHours === null) return null;
  return new Date(event.startsAt.getTime() - event.rsvpDeadlineHours * 60 * 60 * 1000);
}

export function isRsvpClosed(event: { startsAt: Date; rsvpDeadlineHours: number | null }, now = new Date()): boolean {
  const deadline = rsvpDeadline(event);
  return deadline !== null && now >= deadline;
}

/** „Do, 19.11., 19:00 Uhr“ */
export function formatDeadline(deadline: Date): string {
  return `${formatWeekdayShort(deadline)}, ${formatDate(deadline).slice(0, 6)}, ${formatTime(deadline)} Uhr`;
}

/**
 * Was unter den Zu-/Absagen-Knöpfen steht und ob sie gesperrt sind.
 * Wer Termine verwalten darf (Admin), kann auch nach Fristende noch ändern.
 */
export function rsvpState(
  event: { startsAt: Date; rsvpDeadlineHours: number | null },
  canBypass: boolean,
  now = new Date(),
): { locked: boolean; note: string | null } {
  const deadline = rsvpDeadline(event);
  if (!deadline) return { locked: false, note: null };
  const when = formatDeadline(deadline);
  if (now < deadline) return { locked: false, note: `Zu-/Absagen bis ${when}` };
  return canBypass
    ? { locked: false, note: `Frist abgelaufen (${when}). Als Admin kannst du weiter ändern – für andere unter „Rückmeldungen verwalten“ auf der Terminseite.` }
    : { locked: true, note: `Frist abgelaufen (${when}). Änderungen nur noch über den Vorstand.` };
}
