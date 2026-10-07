import { formatDate, toYmd } from "@/lib/dates";
import { listEvents } from "@/server/services/events";
import { listMembers } from "@/server/services/users";
import { listPenaltyTypes } from "@/server/services/penalties";
import { PenaltyForm } from "./penalty-form";

/** Lädt Auswahllisten (Mitglieder, Strafarten, Termine der letzten 60 / nächsten 14 Tage). */
export async function PenaltyFormLoader({ defaults }: { defaults: Parameters<typeof PenaltyForm>[0]["defaults"] }) {
  const now = Date.now();
  const [members, types, events] = await Promise.all([
    listMembers(),
    listPenaltyTypes(),
    listEvents({ from: new Date(now - 60 * 86400000), to: new Date(now + 14 * 86400000), order: "desc", limit: 30 }),
  ]);
  return (
    <PenaltyForm
      members={members.map((m) => ({ id: m.id, displayName: m.displayName, firstName: m.firstName, lastName: m.lastName, avatarImageId: m.avatarImageId }))}
      types={types.map((t) => ({ id: t.id, name: t.name, amountCents: t.amountCents }))}
      events={events.map((e) => ({ id: e.id, label: `${formatDate(e.startsAt)} – ${e.title}` }))}
      defaults={{ ...defaults, date: defaults.date || toYmd(new Date()) }}
    />
  );
}
