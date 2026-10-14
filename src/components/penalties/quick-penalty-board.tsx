"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck, PenLine, Plus, Undo2, X } from "lucide-react";
import { deletePenaltyAction, quickPenaltyAction } from "@/server/actions/penalties";
import { Avatar } from "@/components/ui/avatar";
import { inputClass, Spinner } from "@/components/ui/fields";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatEuro, parseEuroToCents } from "@/lib/format";

interface Member {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
  openCents: number;
}

interface PenaltyType {
  id: string;
  name: string;
  amountCents: number;
}

interface Toast {
  penaltyId: string;
  text: string;
}

/** Muss zur Rückgängig-Frist in `quickPenaltyAction` passen. */
const UNDO_MS = 10_000;

/** Strafe in zwei Taps: Mitglied antippen → Strafart antippen (oder eigenen Titel und Betrag eingeben). */
export function QuickPenaltyBoard({ members, types, canEditCatalog }: { members: Member[]; types: PenaltyType[]; canEditCatalog: boolean }) {
  const [selected, setSelected] = useState<Member | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const open = (m: Member) => {
    setSelected(m);
    setError(null);
    setCustomLabel("");
    setCustomAmount("");
    setSaveToCatalog(false);
    dialog.current?.showModal();
  };

  const close = () => dialog.current?.close();

  const submit = (fields: Record<string, string>, label: string, amountCents: number) => {
    if (!selected) return;
    const member = selected;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", member.id);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await quickPenaltyAction(fd);
      if (!res.ok || !res.penaltyId) {
        setError(res.message ?? "Eintragen fehlgeschlagen.");
        return;
      }
      close();
      setToast({ penaltyId: res.penaltyId, text: `${label} (${formatEuro(amountCents)}) für ${member.displayName}` });
    });
  };

  const give = (type: PenaltyType) => submit({ penaltyTypeId: type.id }, type.name, type.amountCents);

  const giveCustom = () => {
    const label = customLabel.trim();
    const cents = parseEuroToCents(customAmount);
    if (!label) return setError("Bitte einen Titel für die Strafe eingeben.");
    if (cents === null) return setError("Bitte einen Betrag wie 1,50 eingeben.");
    submit({ customLabel: label, amount: customAmount, ...(saveToCatalog ? { saveToCatalog: "on" } : {}) }, label, cents);
  };

  const undo = () => {
    if (!toast) return;
    const { penaltyId } = toast;
    setToast(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", penaltyId);
      await deletePenaltyAction(fd);
    });
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => open(m)}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-eiche bg-theke p-2 text-sm hover:border-messing/60 active:bg-messing/15"
          >
            <Avatar person={m} size="md" />
            <span className="w-full truncate text-center">{m.displayName}</span>
            <span className={cn("text-xs tabular-nums", m.openCents > 0 ? "text-absage" : "text-kreide-dim")}>
              {m.openCents > 0 ? formatEuro(m.openCents) : "–"}
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        onClose={() => setSelected(null)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="mx-auto mb-0 mt-auto w-full max-w-lg rounded-t-2xl border border-eiche bg-theke p-0 text-kreide backdrop:bg-black/70 sm:m-auto sm:rounded-2xl"
      >
        {selected && (
          <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center gap-3">
              <Avatar person={selected} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-kreide-dim">Strafe für</p>
                <h2 className="truncate font-display text-xl font-bold">{selected.displayName}</h2>
              </div>
              <button type="button" onClick={close} aria-label="Schließen" className="flex size-11 items-center justify-center rounded-xl text-kreide-dim hover:bg-theke-2">
                <X size={22} aria-hidden />
              </button>
            </div>

            <div className="grid max-h-[40dvh] gap-2 overflow-y-auto">
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={pending}
                  onClick={() => give(t)}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 border-eiche bg-theke-2 px-4 text-left hover:border-messing/60 active:bg-messing/15 disabled:opacity-50"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="font-display font-bold tabular-nums">{formatEuro(t.amountCents)}</span>
                </button>
              ))}
            </div>

            <form
              className="mt-4 rounded-xl border border-dashed border-eiche p-3"
              onSubmit={(e) => {
                e.preventDefault();
                giveCustom();
              }}
            >
              <p className="mb-2 text-sm font-medium text-kreide-dim">Eigene Strafe</p>
              <div className="grid grid-cols-[1fr_6.5rem] gap-2">
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Titel, z. B. Bier verschüttet"
                  aria-label="Titel der Strafe"
                  maxLength={100}
                  enterKeyHint="next"
                  className={inputClass}
                />
                <input
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="€ 0,00"
                  aria-label="Betrag in Euro"
                  inputMode="decimal"
                  enterKeyHint="done"
                  className={inputClass}
                />
              </div>
              {canEditCatalog && (
                <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" checked={saveToCatalog} onChange={(e) => setSaveToCatalog(e.target.checked)} className="size-5 accent-[var(--color-messing)]" />
                  Auch in den Strafkatalog aufnehmen
                </label>
              )}
              <button type="submit" disabled={pending} className={buttonClass("primary", "md", "mt-2 w-full")}>
                <Plus size={18} aria-hidden /> Eintragen
              </button>
            </form>

            {pending && (
              <p className="mt-3 flex items-center gap-2 text-sm text-kreide-dim">
                <Spinner /> Wird eingetragen …
              </p>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-absage">{error}</p>}

            <Link
              href={`/strafen/neu?mitglied=${selected.id}`}
              className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm text-kreide-dim hover:bg-theke-2 hover:text-kreide"
            >
              <PenLine size={16} aria-hidden /> Mit anderem Datum, Termin oder Kommentar …
            </Link>
          </div>
        )}
      </dialog>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-zusage/50 bg-theke px-4 py-3 shadow-xl lg:bottom-6"
        >
          <CircleCheck size={20} className="shrink-0 text-zusage" aria-hidden />
          <p className="min-w-0 flex-1 text-[15px]">{toast.text} eingetragen.</p>
          <button type="button" onClick={undo} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 font-semibold text-messing-hell hover:bg-theke-2">
            <Undo2 size={16} aria-hidden /> Rückgängig
          </button>
        </div>
      )}
    </>
  );
}
