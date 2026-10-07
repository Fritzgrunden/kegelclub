import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, Trophy } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/dates";
import { computeRanks } from "@/lib/scoring";
import { requireUser } from "@/server/auth/session";
import { getGameSession } from "@/server/services/results";
import { deleteGameSessionAction, reopenGameSessionAction } from "@/server/actions/games";
import { ScoreBoard } from "@/components/games/score-board";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Spielrunde" };

export default async function GameSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = await getGameSession(id);
  if (!session) notFound();

  const isAdmin = hasPermission(user, "results:manage");
  const running = session.status === "LAUFEND";
  const canDelete = isAdmin || (running && session.createdById === user.id);
  const ranked = computeRanks(session.participants, session.game.scoringMode);
  const byId = new Map(session.participants.map((p) => [p.userId, p]));

  return (
    <>
      <PageHeader
        title={session.game.name}
        subtitle={`${session.event.title} · ${formatDate(session.event.startsAt)}`}
        back={`/termine/${session.eventId}`}
        actions={
          <LinkButton href={`/spiele/${session.game.slug}`} variant="ghost">
            <BookOpen size={18} aria-hidden /> Regeln
          </LinkButton>
        }
      />

      {running ? (
        <ScoreBoard
          sessionId={session.id}
          scoringMode={session.game.scoringMode}
          scoreLabel={session.game.scoreLabel}
          participants={session.participants}
        />
      ) : (
        <section className="tafel rounded-md p-4 sm:p-6">
          <h2 className="kreide mb-4 flex items-center gap-2 font-display text-2xl font-bold">
            <Trophy className="text-messing" aria-hidden /> Endstand
          </h2>
          <ol className="flex flex-col gap-1">
            {ranked.map((r) => {
              const p = byId.get(r.userId)!;
              return (
                <li key={r.userId} className={cn("flex min-h-14 items-center gap-3 rounded-lg px-2", r.rank === 1 && "bg-messing/15")}>
                  <span className="kreide w-8 text-center font-display text-3xl font-bold text-messing-hell tabular-nums">{r.rank ?? "–"}</span>
                  <Avatar person={p} size="sm" />
                  <Link href={`/mitglieder/${p.userId}`} className="kreide flex-1 truncate text-lg font-semibold hover:underline">
                    {p.displayName}
                  </Link>
                  <span className="kreide font-display text-3xl font-bold tabular-nums">{r.score ?? "–"}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-right text-sm text-kreide-dim">{session.game.scoreLabel}</p>
        </section>
      )}

      {(isAdmin || canDelete) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {!running && isAdmin && (
            <ActionButton action={reopenGameSessionAction} fields={{ id }} variant="secondary">
              Runde wieder öffnen
            </ActionButton>
          )}
          {canDelete && (
            <ActionButton
              action={deleteGameSessionAction}
              fields={{ id, eventId: session.eventId }}
              variant="ghost"
              confirm={{ title: "Spielrunde löschen?", text: "Alle Ergebnisse dieser Runde gehen verloren.", confirmLabel: "Löschen" }}
            >
              Runde löschen
            </ActionButton>
          )}
        </div>
      )}
    </>
  );
}
