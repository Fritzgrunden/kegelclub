import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Gavel, MapPin, Pencil, Plus, Repeat } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatDateTime, formatTime, formatWeekday, toYmd } from "@/lib/dates";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS, formatEuro } from "@/lib/format";
import { recurrenceLabel } from "@/lib/recurrence";
import { requireUser } from "@/server/auth/session";
import { getEvent, getMyParticipation, getParticipationOverview } from "@/server/services/events";
import { listPenalties } from "@/server/services/penalties";
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

  const canManage = hasPermission(user, "events:manage");
  const canFine = hasPermission(user, "penalties:manage");
  const showPenalties = event.kind === "KEGELABEND" && hasPermission(user, "penalties:view-all");
  const [overview, mine, penalties] = await Promise.all([
    getParticipationOverview(id),
    getMyParticipation(user.id, [id]),
    showPenalties ? listPenalties(user, { eventId: id }) : Promise.resolve([]),
  ]);
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
                  Serie: {recurrenceLabel(event.series)}
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
          {showPenalties && (
            <Card>
              <CardTitle
                action={penalties.length > 0 ? <span className="font-display font-bold tabular-nums">{formatEuro(penalties.reduce((s, p) => s + p.amountCents, 0))}</span> : undefined}
              >
                <span className="flex items-center gap-2"><Gavel size={20} className="text-messing" aria-hidden /> Strafen an diesem Abend</span>
              </CardTitle>
              {penalties.length === 0 ? (
                <p className="text-kreide-dim">Noch keine Strafen – bisher ein braver Abend.</p>
              ) : (
                <ul className="flex flex-col">
                  {penalties.map((p) => (
                    <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 py-1 last:border-0">
                      <span className="min-w-0">
                        <span className="block truncate">{p.label}</span>
                        <span className="block truncate text-xs text-kreide-dim">{p.memberName}</span>
                      </span>
                      <span className="shrink-0 font-display font-bold tabular-nums">{formatEuro(p.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canFine && !cancelled && (
                <LinkButton href={`/strafen/neu?termin=${id}`} variant="secondary" size="lg" className="mt-4 w-full">
                  <Plus size={20} aria-hidden /> Strafe eintragen
                </LinkButton>
              )}
            </Card>
          )}

          {canFine && !showPenalties && (
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
                  confirm={{ title: "Termin löschen?", text: "Die Rückmeldungen werden ebenfalls gelöscht. Strafen bleiben erhalten.", confirmLabel: "Endgültig löschen" }}
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
