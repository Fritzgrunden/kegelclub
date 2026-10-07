import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatDate, formatTime, formatWeekday } from "@/lib/dates";
import type { EventRow, ParticipationCounts } from "@/server/services/events";
import type { RsvpStatus } from "@/server/db/schema";
import { RsvpButtons } from "./rsvp-buttons";

/** Die Kreidetafel: nächster Kegelabend mit Zu-/Absagen auf einen Blick. */
export function NextEveningBoard({
  event,
  counts,
  myStatus,
  label = "Nächster Kegelabend",
}: {
  event: EventRow;
  counts: ParticipationCounts;
  myStatus: RsvpStatus | null;
  label?: string;
}) {
  return (
    <section className="tafel rounded-md p-5 sm:p-6" aria-label={label}>
      <p className="text-sm text-kreide-dim">{label}</p>
      <Link href={`/termine/${event.id}`} className="group block">
        <h2 className="kreide mt-1 font-display text-4xl font-bold leading-none sm:text-5xl">{formatWeekday(event.startsAt)}</h2>
        <p className="kreide mt-2 font-display text-2xl">
          {formatDate(event.startsAt)} · {formatTime(event.startsAt)} Uhr
        </p>
        {event.location && (
          <p className="mt-2 flex items-center gap-1.5 text-kreide-dim">
            <MapPin size={16} aria-hidden /> {event.location}
          </p>
        )}
        <span className="mt-1 inline-block text-sm text-messing-hell underline-offset-4 group-hover:underline">Details & Teilnehmer</span>
      </Link>

      <dl className="my-5 grid grid-cols-3 gap-2 border-y border-dashed border-kreide/25 py-4 text-center">
        <div>
          <dt className="text-xs text-kreide-dim">Zusagen</dt>
          <dd className="kreide font-display text-4xl font-bold tabular-nums text-zusage">{counts.zugesagt}</dd>
        </div>
        <div>
          <dt className="text-xs text-kreide-dim">Absagen</dt>
          <dd className="kreide font-display text-4xl font-bold tabular-nums text-absage">{counts.abgesagt}</dd>
        </div>
        <div>
          <dt className="text-xs text-kreide-dim">ohne Antwort</dt>
          <dd className="kreide font-display text-4xl font-bold tabular-nums">{counts.offen}</dd>
        </div>
      </dl>

      <RsvpButtons eventId={event.id} status={myStatus} disabled={event.status === "ABGESAGT"} />
    </section>
  );
}
