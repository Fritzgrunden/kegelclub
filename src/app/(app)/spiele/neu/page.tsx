import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { GameForm } from "@/components/games/game-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Neues Spiel" };

export default async function NewGamePage() {
  await requirePermission("games:manage");
  return (
    <>
      <PageHeader title="Neues Kegelspiel" back="/spiele" />
      <Card className="max-w-3xl"><GameForm /></Card>
    </>
  );
}
