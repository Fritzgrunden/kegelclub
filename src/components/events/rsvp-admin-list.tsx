"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import type { RsvpStatus } from "@/server/db/schema";
import type { ParticipantInfo } from "@/server/services/events";
import { rsvpForMemberAction } from "@/server/actions/events";

type Choice = RsvpStatus | "KEINE";

const OPTIONS: { value: Choice; label: string; Icon: typeof Check; active: string }[] = [
  { value: "ZUGESAGT", label: "zugesagt", Icon: Check, active: "border-zusage bg-zusage text-bahn" },
  { value: "ABGESAGT", label: "abgesagt", Icon: X, active: "border-absage bg-absage text-white" },
  { value: "KEINE", label: "keine Antwort", Icon: Minus, active: "border-kreide-dim bg-theke-2 text-kreide" },
];

function MemberRow({ eventId, person, status }: { eventId: string; person: ParticipantInfo; status: Choice }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (next: Choice) => {
    if (next === optimistic) return;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const fd = new FormData();
      fd.set("eventId", eventId);
      fd.set("userId", person.userId);
      fd.set("status", next);
      const res = await rsvpForMemberAction(fd);
      if (!res.ok) setError(res.message ?? "Speichern fehlgeschlagen.");
    });
  };

  return (
    <li className="border-b border-eiche/50 py-2 last:border-0">
      <div className="flex items-center gap-2">
        <Avatar person={person} size="sm" />
        <span className="min-w-0 flex-1 truncate">{person.displayName}</span>
        <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Rückmeldung ${person.displayName}`}>
          {OPTIONS.map(({ value, label, Icon, active }) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              aria-pressed={optimistic === value}
              aria-label={`${person.displayName}: ${label}`}
              title={label}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border-2 transition-colors",
                optimistic === value ? active : "border-eiche text-kreide-dim hover:border-messing/50",
              )}
            >
              <Icon size={18} aria-hidden />
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-absage">{error}</p>}
    </li>
  );
}

/**
 * Nur für Admins: Rückmeldungen anderer Mitglieder setzen – z. B. nach Fristende auf Zuruf.
 * Zugeklappt, damit die Terminseite für den Alltag übersichtlich bleibt.
 */
export function RsvpAdminList({
  eventId,
  zugesagt,
  abgesagt,
  offen,
}: {
  eventId: string;
  zugesagt: ParticipantInfo[];
  abgesagt: ParticipantInfo[];
  offen: ParticipantInfo[];
}) {
  const rows = [
    ...zugesagt.map((p) => ({ p, s: "ZUGESAGT" as Choice })),
    ...abgesagt.map((p) => ({ p, s: "ABGESAGT" as Choice })),
    ...offen.map((p) => ({ p, s: "KEINE" as Choice })),
  ].sort((a, b) => a.p.displayName.localeCompare(b.p.displayName, "de"));

  return (
    <details className="group rounded-2xl border border-eiche/70 bg-theke">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold">Rückmeldungen verwalten</span>
          <span className="block text-xs text-kreide-dim">Für Mitglieder zu- oder absagen – auch nach Fristende</span>
        </span>
        <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="border-t border-eiche/60 px-4 py-1">
        {rows.map(({ p, s }) => (
          <MemberRow key={p.userId} eventId={eventId} person={p} status={s} />
        ))}
      </ul>
    </details>
  );
}
