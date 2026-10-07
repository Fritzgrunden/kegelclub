import Link from "next/link";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { EventKind } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/types";
import { getMyParticipation, getParticipationCounts, listEvents, upcomingThreshold } from "@/server/services/events";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EventCard } from "./event-card";

export async function EventListPage({ user, kind, past, basePath }: { user: SessionUser; kind: EventKind; past: boolean; basePath: string }) {
  const threshold = upcomingThreshold();
  const events = await listEvents(past ? { kind, to: threshold, order: "desc", limit: 50 } : { kind, from: threshold, limit: 60 });
  const ids = events.map((e) => e.id);
  const [counts, mine] = await Promise.all([getParticipationCounts(ids), getMyParticipation(user.id, ids)]);
  const canManage = hasPermission(user, "events:manage");
  const title = kind === "KEGELABEND" ? "Kegelabende" : "Events";

  return (
    <>
      <PageHeader
        title={title}
        actions={canManage ? <LinkButton href={`/termine/neu?art=${kind}`}><Plus size={18} aria-hidden /> Neu</LinkButton> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 rounded-xl border border-eiche bg-theke p-1" role="tablist">
        {[
          ["Kommende", basePath, !past],
          ["Vergangene", `${basePath}?zeit=vergangen`, past],
        ].map(([label, href, active]) => (
          <Link
            key={String(label)}
            href={String(href)}
            role="tab"
            aria-selected={Boolean(active)}
            className={cn("flex min-h-11 items-center justify-center rounded-lg text-[15px] font-medium", active ? "bg-theke-2 text-kreide" : "text-kreide-dim")}
          >
            {label}
          </Link>
        ))}
      </div>
      {events.length === 0 ? (
        <EmptyState
          title={past ? `Noch keine vergangenen ${title}.` : kind === "KEGELABEND" ? "Noch keine Kegelabende geplant." : "Noch keine Events geplant."}
          action={!past && canManage ? <LinkButton href={`/termine/neu?art=${kind}`}><Plus size={18} aria-hidden /> {kind === "KEGELABEND" ? "Kegelabend erstellen" : "Event erstellen"}</LinkButton> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} counts={counts.get(e.id)} myStatus={past ? undefined : (mine.get(e.id) ?? null)} />
          ))}
        </div>
      )}
    </>
  );
}
