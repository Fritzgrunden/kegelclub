import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getGameBySlug } from "@/server/services/games";
import { GameForm } from "@/components/games/game-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Spiel bearbeiten" };

export default async function EditGamePage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePermission("games:manage");
  const game = await getGameBySlug((await params).slug);
  if (!game) notFound();
  return (
    <>
      <PageHeader title={`${game.name} bearbeiten`} back={`/spiele/${game.slug}`} />
      <Card className="max-w-3xl"><GameForm game={game} /></Card>
    </>
  );
}
