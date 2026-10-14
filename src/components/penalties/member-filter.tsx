"use client";

import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui/fields";
import { cn } from "@/components/ui/cn";

/** Auswahl eines Mitglieds als Filter; wechselt sofort die URL (ohne extra „Filtern“-Knopf). */
export function MemberFilter({
  members,
  value,
  baseHref,
  className,
}: {
  members: { id: string; displayName: string }[];
  value: string;
  /** URL ohne Mitglied; der Parameter `mitglied` wird angehängt. */
  baseHref: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Nach Mitglied filtern"
      value={value}
      onChange={(e) => {
        const sep = baseHref.includes("?") ? "&" : "?";
        router.push(e.target.value ? `${baseHref}${sep}mitglied=${e.target.value}` : baseHref, { scroll: false });
      }}
      className={cn(inputClass, "appearance-none", className)}
    >
      <option value="">Alle Mitglieder</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.displayName}</option>
      ))}
    </select>
  );
}
