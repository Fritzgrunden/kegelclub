import { ArrowDownLeft, ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import { formatEuro } from "@/lib/format";
import { formatYmd } from "@/lib/dates";
import type { CashEntryItem, CashSummary } from "@/server/services/cash";
import { deleteCashEntryAction } from "@/server/actions/cash";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";
import { CashEntryForm } from "./cash-entry-form";

function Row({ label, cents, sign }: { label: string; cents: number; sign: "+" | "−" }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b border-eiche/40 last:border-0">
      <span className="text-kreide-dim">{label}</span>
      <span className={cn("font-display font-bold tabular-nums", sign === "+" ? "text-zusage" : "text-absage")}>
        {sign} {formatEuro(cents)}
      </span>
    </li>
  );
}

function EntryLine({ e }: { e: CashEntryItem }) {
  const advanced = e.kind === "AUSGABE" && e.paidByName;
  const Icon = e.kind === "EINNAHME" ? ArrowDownLeft : ArrowUpRight;
  return (
    <>
      <Icon size={18} className={cn("shrink-0", e.kind === "EINNAHME" ? "text-zusage" : "text-absage")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{e.description}</span>
        <span className="block truncate text-xs text-kreide-dim">
          {formatYmd(e.date)}
          {advanced && ` · von ${e.paidByName} ausgelegt`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block font-display text-lg font-bold tabular-nums", advanced ? "text-kreide-dim" : e.kind === "EINNAHME" ? "text-zusage" : "text-absage")}>
          {e.kind === "EINNAHME" ? "+" : "−"} {formatEuro(e.amountCents)}
        </span>
        {advanced && <span className="block text-xs text-kreide-dim">verrechnet</span>}
      </span>
    </>
  );
}

/** Reiter „Kasse“: Kassenstand für alle, Einnahmen/Ausgaben für den Kassenwart. */
export function CashView({
  summary,
  entries,
  credits,
  manage,
  members,
  today,
}: {
  summary: CashSummary;
  entries: CashEntryItem[];
  credits: { userId: string; displayName: string; creditCents: number }[];
  manage: boolean;
  members: { id: string; displayName: string }[];
  today: string;
}) {
  return (
    <>
      <section className="tafel mb-5 rounded-md p-5 text-center">
        <p className="text-sm text-kreide-dim">In der Kasse</p>
        <p className={cn("kreide font-display text-5xl font-bold tabular-nums", summary.balanceCents < 0 && "text-absage")}>{formatEuro(summary.balanceCents)}</p>
      </section>

      {manage && (
        <details className="group mb-5 rounded-2xl border border-messing/50 bg-theke">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-messing-hell [&::-webkit-details-marker]:hidden">
            <Plus size={20} aria-hidden /> Einnahme oder Ausgabe eintragen
          </summary>
          <div className="border-t border-eiche/60 p-4">
            <CashEntryForm members={members} today={today} />
          </div>
        </details>
      )}

      <details className="group mb-5 rounded-2xl border border-eiche/70 bg-theke">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">So setzt sich der Kassenstand zusammen</span>
          <ChevronDown size={18} className="shrink-0 text-kreide-dim transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="border-t border-eiche/50 px-4 pb-2">
          <Row label="Bezahlte Strafen" cents={summary.penaltiesCents} sign="+" />
          <Row label="Bezahlte Beiträge" cents={summary.duesCents} sign="+" />
          <Row label="Sonstige Einnahmen" cents={summary.incomeCents} sign="+" />
          <Row label="Ausgaben aus der Kasse" cents={summary.expenseCents} sign="−" />
        </ul>
        {summary.advancedCents > 0 && (
          <p className="border-t border-eiche/50 px-4 py-3 text-sm text-kreide-dim">
            Dazu haben Mitglieder {formatEuro(summary.advancedCents)} ausgelegt und mit ihren Strafen verrechnet – das ändert den Kassenstand nicht.
          </p>
        )}
      </details>

      {credits.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-display text-lg font-bold">Guthaben</h2>
          <p className="mb-2 text-sm text-kreide-dim">Wird automatisch mit den nächsten Strafen verrechnet.</p>
          <ul className="overflow-hidden rounded-2xl border border-eiche/70 bg-theke">
            {credits.map((c) => (
              <li key={c.userId} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 px-3 last:border-0">
                <span className="truncate">{c.displayName}</span>
                <span className="font-display font-bold tabular-nums text-zusage">{formatEuro(c.creditCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 font-display text-lg font-bold">Kassenbuch</h2>
      {entries.length === 0 ? (
        <EmptyState title="Noch keine Einnahmen oder Ausgaben eingetragen." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-eiche/70 bg-theke">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-eiche/50 last:border-0">
              {manage ? (
                <details className="group">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-theke-2/50 [&::-webkit-details-marker]:hidden">
                    <EntryLine e={e} />
                    <ChevronDown size={18} className="shrink-0 text-kreide-dim transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="bg-theke-2/40 px-3 pb-3 pt-1">
                    <ActionButton
                      action={deleteCashEntryAction}
                      fields={{ id: e.id }}
                      variant="secondary"
                      size="md"
                      className="w-full"
                      confirm={{
                        title: "Eintrag löschen?",
                        text: e.paidByName
                          ? `${e.description} (${formatEuro(e.amountCents)}). Schon verrechnete Strafen von ${e.paidByName} werden wieder offen.`
                          : `${e.description} (${formatEuro(e.amountCents)})`,
                        confirmLabel: "Löschen",
                      }}
                    >
                      Löschen
                    </ActionButton>
                  </div>
                </details>
              ) : (
                <div className="flex min-h-16 items-center gap-3 px-3 py-2">
                  <EntryLine e={e} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
