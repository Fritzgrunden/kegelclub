import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Dices, Gavel, MapPin, Pencil, Plus, Repeat, Trophy } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatDateTime, formatTime, formatWeekday, toYmd } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from "@/lib/format";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import { requireUser } from "@/server/auth/session";
import { getEvent, getMyParticipation, getParticipationOverview } from "@/server/services/events";
import { listSessionsForEvent } from "@/server/services/results";
import { deleteEventAction, setEventStatusAction } from "@/server/actions/events";
import { RsvpButtons } from "@/components/events/rsvp-buttons";
import { ParticipantList } from "@/components/events/participant-list";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";

export const metadata: Metadata = { title: "Termin" };

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [overview, mine, sessions] = await Promise.all([
    getParticipationOverview(id),
    getMyParticipation(user.id, [id]),
    listSessionsForEvent(id),
  ]);
  const canManage = hasPermission(user, "events:manage");
  const canFine = hasPermission(user, "penalties:manage");
  const cancelled = event.status === "ABGESAGT";
  const multiDay = event.endsAt && toYmd(event.endsAt) !== toYmd(event.startsAt);
  const back = event.kind === "EVENT" ? "/events" : "/kegelabende";

  return (
    <>
      <PageHeader
        title={event.title}
        back={back}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {event.kind === "EVENT" && event.eventType ? EVENT_TYPE_LABELS[event.eventType] : "Kegelabend"}
            {event.status !== "GEPLANT" && <Badge tone={cancelled ? "absage" : "neutral"}>{EVENT_STATUS_LABELS[event.status]}</Badge>}
          </span>
        }
        actions={
          canManage ? (
            <LinkButton href={`/termine/${id}/bearbeiten`} variant="secondary">
              <Pencil size={18} aria-hidden /> Bearbeiten
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-5">
          {event.imageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/bilder/${event.imageId}`} alt="" className="max-h-72 w-full rounded-2xl border border-eiche object-cover" />
          )}

          <section className="tafel rounded-md p-5">
            <ul className="kreide flex flex-col gap-2.5 text-lg">
              <li className="flex items-center gap-3">
                <CalendarDays size={20} aria-hidden className="shrink-0 text-messing" />
                {multiDay ? `${formatDate(event.startsAt)} – ${formatDate(event.endsAt!)}` : `${formatWeekday(event.startsAt)}, ${formatDate(event.startsAt)}`}
              </li>
              <li className="flex items-center gap-3">
                <Clock size={20} aria-hidden className="shrink-0 text-messing" />
                {formatTime(event.startsAt)} Uhr{event.endsAt && !multiDay && ` – ${formatTime(event.endsAt)} Uhr`}
                {multiDay && event.endsAt && ` (Ende ${formatDateTime(event.endsAt)})`}
              </li>
              {event.location && (
                <li className="flex items-center gap-3">
                  <MapPin size={20} aria-hidden className="shrink-0 text-messing" /> {event.location}
                </li>
              )}
              {event.series && (
                <li className="flex items-center gap-3 text-base text-kreide-dim">
                  <Repeat size={18} aria-hidden className="shrink-0" />
                  Serie: {RECURRENCE_LABELS[event.series.recurrence]}
                  {event.series.recurrence === "INDIVIDUELL" && ` (${event.series.intervalDays} Tage)`}
                  {event.isDetached && " · einzeln geändert"}
                </li>
              )}
            </ul>

            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-dashed border-kreide/25 pt-4 text-center">
              <div><dt className="text-xs text-kreide-dim">Zusagen</dt><dd className="kreide font-display text-4xl font-bold text-zusage tabular-nums">{overview.zugesagt.length}</dd></div>
              <div><dt className="text-xs text-kreide-dim">Absagen</dt><dd className="kreide font-display text-4xl font-bold text-absage tabular-nums">{overview.abgesagt.length}</dd></div>
              <div><dt className="text-xs text-kreide-dim">ohne Antwort</dt><dd className="kreide font-display text-4xl font-bold tabular-nums">{overview.offen.length}</dd></div>
            </dl>
            {!cancelled ? (
              <div className="mt-5"><RsvpButtons eventId={id} status={mine.get(id) ?? null} /></div>
            ) : (
              <p className="mt-4 text-center text-absage">Dieser Termin wurde abgesagt.</p>
            )}
          </section>

          {event.description && (
            <Card>
              <CardTitle>Beschreibung</CardTitle>
              <p className="whitespace-pre-line leading-relaxed text-kreide/90">{event.description}</p>
            </Card>
          )}

          <Card className="flex flex-col gap-5">
            <ParticipantList title="Zugesagt" people={overview.zugesagt} tone="zusage" />
            <ParticipantList title="Abgesagt" people={overview.abgesagt} tone="absage" />
            <ParticipantList title="Noch keine Rückmeldung" people={overview.offen} tone="offen" />
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle><span className="flex items-center gap-2"><Dices size={20} className="text-messing" aria-hidden /> Spiele</span></CardTitle>
            {!cancelled && (
              <LinkButton href={`/termine/${id}/spiel-neu`} size="xl" className="mb-4 w-full">
                <Plus size={22} aria-hidden /> Spiel hinzufügen
              </LinkButton>
            )}
            {sessions.length === 0 ? (
              <p className="text-kreide-dim">Noch keine Spiele erfasst.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/spielrunden/${s.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-eiche bg-theke-2/50 px-3 py-2 hover:border-messing/50">
                      <span>
                        <span className="block font-semibold">{s.gameName}</span>
                        <span className="block text-xs text-kreide-dim">
                          {s.status === "LAUFEND" ? "läuft noch" : s.winners.length ? `Sieg: ${s.winners.map((w) => w.name).join(", ")}` : "abgeschlossen"}
                        </span>
                      </span>
                      {s.status === "LAUFEND" ? <Badge tone="messing">Läuft</Badge> : <Trophy size={20} className="text-messing" aria-hidden />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canFine && (
            <LinkButton href={`/strafen/neu?termin=${id}`} variant="secondary" size="lg">
              <Gavel size={20} aria-hidden /> Strafe für diesen Termin
            </LinkButton>
          )}

          {canManage && (
            <Card>
              <CardTitle>Verwaltung</CardTitle>
              <div className="flex flex-col gap-2">
                {event.status === "GEPLANT" && (
                  <ActionButton
                    action={setEventStatusAction}
                    fields={{ id, status: "ABGESAGT" }}
                    confirm={{ title: "Termin absagen?", text: "Alle sehen den Termin dann als abgesagt. Du kannst das rückgängig machen.", confirmLabel: "Absagen" }}
                    variant="secondary"
                  >
                    Termin absagen
                  </ActionButton>
                )}
                {event.status !== "GEPLANT" && (
                  <ActionButton action={setEventStatusAction} fields={{ id, status: "GEPLANT" }} variant="secondary">
                    Wieder auf „geplant“ setzen
                  </ActionButton>
                )}
                {event.status === "GEPLANT" && event.startsAt < new Date() && (
                  <ActionButton action={setEventStatusAction} fields={{ id, status: "ABGESCHLOSSEN" }} variant="secondary">
                    Als abgeschlossen markieren
                  </ActionButton>
                )}
                <ActionButton
                  action={deleteEventAction}
                  fields={{ id, scope: "EINZELN", kind: event.kind }}
                  variant="danger"
                  confirm={{ title: "Termin löschen?", text: "Rückmeldungen und erfasste Spiele dieses Termins werden ebenfalls gelöscht.", confirmLabel: "Endgültig löschen" }}
                >
                  Termin löschen
                </ActionButton>
                {event.series && (
                  <ActionButton
                    action={deleteEventAction}
                    fields={{ id, scope: "FOLGENDE", kind: event.kind }}
                    variant="danger"
                    confirm={{ title: "Diesen und alle folgenden löschen?", text: "Die Serie endet dann vor diesem Termin.", confirmLabel: "Alle folgenden löschen" }}
                  >
                    Diesen & alle folgenden löschen
                  </ActionButton>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
