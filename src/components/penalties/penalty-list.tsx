import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { formatEuro } from "@/lib/format";
import { formatYmd } from "@/lib/dates";
import type { PenaltyListItem } from "@/server/services/penalties";
import { deletePenaltyAction, togglePenaltyPaidAction } from "@/server/actions/penalties";
import { ActionButton } from "@/components/ui/action-button";
import { cn } from "@/components/ui/cn";

function Meta({ p, showMember }: { p: PenaltyListItem; showMember: boolean }) {
  return (
    <span className="block truncate text-xs text-kreide-dim">
      {showMember && <span className="text-kreide/80">{p.memberName} · </span>}
      {formatYmd(p.date)}
      {p.eventTitle && ` · ${p.eventTitle}`}
    </span>
  );
}

function Amount({ p }: { p: PenaltyListItem }) {
  return (
    <span className="shrink-0 text-right">
      <span className={cn("block font-display text-lg font-bold tabular-nums", p.paidAt && "text-kreide-dim line-through decoration-1")}>{formatEuro(p.amountCents)}</span>
      <span className={cn("block text-xs", p.paidAt ? "text-zusage" : "text-absage")}>{p.paidAt ? "bezahlt" : "offen"}</span>
    </span>
  );
}

/**
 * Kompakte Liste: eine Zeile pro Strafe. Für den Kassenwart klappt ein Tipp die Aktionen auf –
 * so bleibt die Liste auch mit vielen Einträgen am Handy übersichtlich.
 */
export function PenaltyList({ items, manage, showMember }: { items: PenaltyListItem[]; manage: boolean; showMember: boolean }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-eiche/70 bg-theke">
      {items.map((p) => (
        <li key={p.id} className="border-b border-eiche/50 last:border-0">
          {manage ? (
            <details className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-theke-2/50 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.label}</span>
                  <Meta p={p} showMember={showMember} />
                </span>
                <Amount p={p} />
                <ChevronDown size={18} className="shrink-0 text-kreide-dim transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="bg-theke-2/40 px-3 pb-3 pt-1">
                {p.comment && <p className="mb-2 text-sm italic text-kreide-dim">„{p.comment}“</p>}
                {showMember && (
                  <p className="mb-2 text-sm">
                    <Link href={`/strafen?ansicht=verlauf&mitglied=${p.userId}`} className="text-messing-hell hover:underline">Alle Strafen von {p.memberName}</Link>
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <ActionButton action={togglePenaltyPaidAction} fields={{ id: p.id, paid: p.paidAt ? "0" : "1" }} variant={p.paidAt ? "secondary" : "zusage"} size="md">
                    {p.paidAt ? "Offen" : "Bezahlt"}
                  </ActionButton>
                  <Link href={`/strafen/${p.id}/bearbeiten`} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-eiche bg-theke-2 px-2 text-[15px]">
                    <Pencil size={15} aria-hidden /> Ändern
                  </Link>
                  <ActionButton
                    action={deletePenaltyAction}
                    fields={{ id: p.id }}
                    variant="secondary"
                    size="md"
                    confirm={{ title: "Strafe löschen?", text: `${p.label} (${formatEuro(p.amountCents)}) für ${p.memberName}`, confirmLabel: "Löschen" }}
                  >
                    Löschen
                  </ActionButton>
                </div>
              </div>
            </details>
          ) : (
            <div className="flex min-h-16 items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.label}</span>
                <Meta p={p} showMember={showMember} />
                {p.comment && <span className="block truncate text-xs italic text-kreide-dim">„{p.comment}“</span>}
              </span>
              <Amount p={p} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
