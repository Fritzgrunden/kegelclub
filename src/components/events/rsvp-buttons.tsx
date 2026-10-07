"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { RsvpStatus } from "@/server/db/schema";
import { rsvpAction } from "@/server/actions/events";

/** Große Zusagen/Absagen-Schalter mit sofortiger (optimistischer) Rückmeldung. */
export function RsvpButtons({
  eventId,
  status,
  size = "lg",
  disabled,
}: {
  eventId: string;
  status: RsvpStatus | null;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (next: RsvpStatus) => {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const fd = new FormData();
      fd.set("eventId", eventId);
      fd.set("status", next);
      const res = await rsvpAction(fd);
      if (!res.ok) setError(res.message ?? "Speichern fehlgeschlagen.");
    });
  };

  const base = cn(
    "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 font-semibold transition-colors",
    size === "lg" ? "min-h-14 text-base" : "min-h-12 text-[15px]",
    "disabled:opacity-50",
  );

  return (
    <div>
      <div className="flex gap-3" role="group" aria-label="Teilnahme">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={optimistic === "ZUGESAGT"}
          onClick={() => choose("ZUGESAGT")}
          className={cn(base, optimistic === "ZUGESAGT" ? "border-zusage bg-zusage text-bahn" : "border-zusage/50 text-zusage hover:bg-zusage/10")}
        >
          <Check size={20} aria-hidden /> {optimistic === "ZUGESAGT" ? "Bin dabei" : "Zusagen"}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={optimistic === "ABGESAGT"}
          onClick={() => choose("ABGESAGT")}
          className={cn(base, optimistic === "ABGESAGT" ? "border-absage bg-absage text-white" : "border-absage/50 text-absage hover:bg-absage/10")}
        >
          <X size={20} aria-hidden /> {optimistic === "ABGESAGT" ? "Abgesagt" : "Absagen"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-absage">{error}</p>}
    </div>
  );
}
