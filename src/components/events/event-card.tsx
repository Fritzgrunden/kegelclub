import Link from "next/link";
import { MapPin, Repeat } from "lucide-react";
import { formatDate, formatTime, formatWeekdayShort, toZonedParts } from "@/lib/dates";
import { EVENT_TYPE_LABELS } from "@/lib/format";
import type { EventRow, ParticipationCounts } from "@/server/services/events";
import type { RsvpStatus } from "@/server/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

/** Termin als Listeneintrag mit Datumsblock links – wie eine Tafel-Notiz. */
export function EventCard({
  event,
  counts,
  myStatus,
}: {
  event: EventRow;
  counts?: ParticipationCounts;
  myStatus?: RsvpStatus | null;
}) {
  const p = toZonedParts(event.startsAt);
  const cancelled = event.status === "ABGESAGT";
  return (
    <Link
      href={`/termine/${event.id}`}
      className={cn(
        "flex items-stretch gap-4 rounded-2xl border border-eiche/70 bg-theke p-3 pr-4 transition-colors hover:border-messing/50",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-tafel py-2 text-center">
        <span className="text-xs uppercase text-kreide-dim">{formatWeekdayShort(event.startsAt)}</span>
        <span className="kreide font-display text-2xl font-bold leading-none">{p.day}</span>
        <span className="text-xs text-kreide-dim">{formatDate(event.startsAt).slice(3, 5)}.{String(p.year).slice(2)}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("font-display text-lg font-bold leading-snug", cancelled && "line-through")}>{event.title}</h3>
          {event.seriesId && <Repeat size={14} className="text-kreide-dim" aria-label="Serientermin" />}
        </div>
        <p className="text-sm text-kreide-dim">
          {formatTime(event.startsAt)} Uhr
          {event.kind === "EVENT" && event.eventType && <> · {EVENT_TYPE_LABELS[event.eventType]}</>}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-kreide-dim">
            <MapPin size={14} aria-hidden className="shrink-0" /> <span className="truncate">{event.location}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cancelled && <Badge tone="absage">Abgesagt</Badge>}
          {!cancelled && counts && (
            <>
              <Badge tone="zusage">{counts.zugesagt} dabei</Badge>
              {counts.abgesagt > 0 && <Badge tone="absage">{counts.abgesagt} abgesagt</Badge>}
            </>
          )}
          {!cancelled && myStatus === "ZUGESAGT" && <Badge tone="messing">Du bist dabei</Badge>}
          {!cancelled && myStatus === "ABGESAGT" && <Badge>Du hast abgesagt</Badge>}
          {!cancelled && myStatus === null && <Badge tone="messing">Antwort fehlt</Badge>}
        </div>
      </div>
    </Link>
  );
}
