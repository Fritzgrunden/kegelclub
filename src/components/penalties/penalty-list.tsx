import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatEuro } from "@/lib/format";
import { formatYmd } from "@/lib/dates";
import type { PenaltyListItem } from "@/server/services/penalties";
import { deletePenaltyAction, togglePenaltyPaidAction } from "@/server/actions/penalties";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";

export function PenaltyList({ items, manage, showMember }: { items: PenaltyListItem[]; manage: boolean; showMember: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((p) => (
        <li key={p.id} className="rounded-xl border border-eiche/70 bg-theke p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {showMember && <Link href={`/mitglieder/${p.userId}`} className="font-semibold hover:underline">{p.memberName}</Link>}
              <p className={showMember ? "text-kreide/90" : "font-semibold"}>{p.label}</p>
              <p className="text-xs text-kreide-dim">
                {formatYmd(p.date)}
                {p.eventTitle && <> · <Link href={`/termine/${p.eventId}`} className="hover:underline">{p.eventTitle}</Link></>}
              </p>
              {p.comment && <p className="mt-1 text-sm italic text-kreide-dim">„{p.comment}“</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-xl font-bold tabular-nums">{formatEuro(p.amountCents)}</p>
              {p.paidAt ? <Badge tone="zusage">bezahlt</Badge> : <Badge tone="absage">offen</Badge>}
            </div>
          </div>
          {manage && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-eiche/50 pt-3">
              <ActionButton action={togglePenaltyPaidAction} fields={{ id: p.id, paid: p.paidAt ? "0" : "1" }} variant={p.paidAt ? "ghost" : "zusage"} size="sm">
                {p.paidAt ? "Als offen markieren" : "Bezahlt"}
              </ActionButton>
              <Link href={`/strafen/${p.id}/bearbeiten`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-kreide-dim hover:bg-theke-2 hover:text-kreide">
                <Pencil size={15} aria-hidden /> Bearbeiten
              </Link>
              <ActionButton
                action={deletePenaltyAction}
                fields={{ id: p.id }}
                variant="ghost"
                size="sm"
                confirm={{ title: "Strafe löschen?", text: `${p.label} (${formatEuro(p.amountCents)}) für ${p.memberName}`, confirmLabel: "Löschen" }}
              >
                Löschen
              </ActionButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
