import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { ParticipantInfo } from "@/server/services/events";

export function ParticipantList({ title, people, tone }: { title: string; people: ParticipantInfo[]; tone: "zusage" | "absage" | "offen" }) {
  const color = tone === "zusage" ? "text-zusage" : tone === "absage" ? "text-absage" : "text-offen";
  return (
    <section>
      <h3 className={`mb-2 flex items-baseline gap-2 font-display text-lg font-bold ${color}`}>
        {title} <span className="text-base tabular-nums">({people.length})</span>
      </h3>
      {people.length === 0 ? (
        <p className="text-sm text-kreide-dim">Niemand.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => (
            <li key={p.userId}>
              <Link href={`/mitglieder/${p.userId}`} className="flex min-h-11 items-center gap-2 rounded-full border border-eiche bg-theke-2/60 py-1 pl-1 pr-3.5 text-sm hover:border-messing/50">
                <Avatar person={p} size="sm" />
                {p.displayName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
