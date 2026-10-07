import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getEvent, getParticipationOverview } from "@/server/services/events";
import { listGames } from "@/server/services/games";
import { StartGameForm } from "@/components/games/start-game-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Spiel hinzufügen" };

export default async function NewGameSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ spiel?: string }> }) {
  await requirePermission("results:enter");
  const { id } = await params;
  const { spiel } = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();
  const [games, overview] = await Promise.all([listGames(), getParticipationOverview(id)]);

  const players = [
    ...overview.zugesagt.map((p) => ({ ...p, confirmed: true })),
    ...overview.offen.map((p) => ({ ...p, confirmed: false })),
    ...overview.abgesagt.map((p) => ({ ...p, confirmed: false })),
  ];

  return (
    <>
      <PageHeader title="Spiel hinzufügen" subtitle={`${event.title} · ${formatDate(event.startsAt)}`} back={`/termine/${id}`} />
      {games.length === 0 ? (
        <EmptyState title="Noch keine Kegelspiele angelegt." text="Ein Admin kann unter „Spiele“ neue Spiele hinzufügen." />
      ) : (
        <StartGameForm eventId={id} games={games} players={players} preselectedGameId={games.find((g) => g.slug === spiel)?.id} />
      )}
    </>
  );
}
