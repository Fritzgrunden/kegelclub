import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { listGames } from "@/server/services/games";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Kegelspiele" };

export default async function GamesPage() {
  const user = await requireUser();
  const canManage = hasPermission(user, "games:manage");
  const games = await listGames({ includeInactive: canManage });
  return (
    <>
      <PageHeader
        title="Kegelspiele"
        subtitle="Die Klassiker – mit Regeln zum Nachlesen."
        actions={canManage ? <LinkButton href="/spiele/neu"><Plus size={18} aria-hidden /> Neues Spiel</LinkButton> : undefined}
      />
      {games.length === 0 ? (
        <EmptyState title="Noch keine Spiele angelegt." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {games.map((g) => (
            <Link key={g.id} href={`/spiele/${g.slug}`} className="rounded-2xl border border-eiche/70 bg-theke p-4 hover:border-messing/50">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{g.name}</h2>
                {!g.active && <Badge>inaktiv</Badge>}
              </div>
              <p className="mt-1 text-kreide-dim">{g.shortDescription}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-kreide-dim"><Users size={16} aria-hidden /> {g.players}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
