import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Play, Target, Trophy, Users } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { SCORING_STRATEGIES } from "@/lib/scoring";
import { requireUser } from "@/server/auth/session";
import { getGameBySlug } from "@/server/services/games";
import { getNextEvent } from "@/server/services/events";
import { deleteGameAction } from "@/server/actions/games";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const game = await getGameBySlug((await params).slug);
  return { title: game?.name ?? "Spiel" };
}

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const game = await getGameBySlug((await params).slug);
  if (!game) notFound();
  const canManage = hasPermission(user, "games:manage");
  const next = await getNextEvent("KEGELABEND");

  return (
    <>
      <PageHeader
        title={game.name}
        subtitle={game.shortDescription}
        back="/spiele"
        actions={canManage ? <LinkButton href={`/spiele/${game.slug}/bearbeiten`} variant="secondary"><Pencil size={18} aria-hidden /> Bearbeiten</LinkButton> : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <section className="tafel rounded-md p-5">
            <h2 className="kreide mb-2 flex items-center gap-2 font-display text-xl font-bold"><Target size={20} className="text-messing" aria-hidden /> Ziel</h2>
            <p className="kreide text-lg leading-relaxed">{game.goal}</p>
          </section>
          <Card>
            <CardTitle>So wird gespielt</CardTitle>
            <p className="whitespace-pre-line leading-relaxed text-kreide/90">{game.procedure}</p>
          </Card>
          {game.rules.length > 0 && (
            <Card>
              <CardTitle>Regeln</CardTitle>
              <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-display marker:text-messing">
                {game.rules.map((r, i) => <li key={i} className="pl-1 leading-relaxed">{r}</li>)}
              </ol>
            </Card>
          )}
          <Card>
            <CardTitle>Beispiel</CardTitle>
            <p className="whitespace-pre-line leading-relaxed text-kreide/90">{game.example}</p>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <dl className="flex flex-col gap-4">
              <div>
                <dt className="flex items-center gap-2 text-sm text-kreide-dim"><Users size={16} aria-hidden /> Spieler</dt>
                <dd className="mt-0.5 font-semibold">{game.players}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-sm text-kreide-dim"><Trophy size={16} aria-hidden /> Wertung</dt>
                <dd className="mt-0.5 leading-relaxed">{game.scoring}</dd>
                <dd className="mt-1 text-sm text-kreide-dim">In der App: {SCORING_STRATEGIES[game.scoringMode].label} ({game.scoreLabel})</dd>
              </div>
            </dl>
          </Card>
          {next && game.active && (
            <LinkButton href={`/termine/${next.id}/spiel-neu?spiel=${game.slug}`} size="xl">
              <Play size={20} aria-hidden /> Beim nächsten Kegelabend spielen
            </LinkButton>
          )}
          {canManage && (
            <ActionButton
              action={deleteGameAction}
              fields={{ id: game.id }}
              variant="ghost"
              confirm={{ title: "Spiel löschen?", text: "Wurde das Spiel bereits gespielt, wird es nur deaktiviert, damit die Ergebnisse erhalten bleiben.", confirmLabel: "Löschen" }}
            >
              Spiel löschen
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}
