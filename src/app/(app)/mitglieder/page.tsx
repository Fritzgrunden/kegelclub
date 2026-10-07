import Link from "next/link";
import type { Metadata } from "next";
import { Cake } from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatYmd } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { listMembers } from "@/server/services/users";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Mitglieder" };

export default async function MembersPage() {
  await requireUser();
  const members = await listMembers();
  return (
    <>
      <PageHeader title="Mitglieder" subtitle={`${members.length} im Club`} />
      {members.length === 0 ? (
        <EmptyState title="Noch keine Mitglieder." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/mitglieder/${m.id}`} className="flex h-full flex-col items-center rounded-2xl border border-eiche/70 bg-theke px-3 py-5 text-center hover:border-messing/50">
                <Avatar person={m} size="lg" />
                <p className="mt-3 font-display text-lg font-bold leading-tight">{m.nickname || m.firstName}</p>
                <p className="text-sm text-kreide-dim">{m.firstName} {m.lastName}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {m.roles.filter((r) => r !== "MITGLIED").map((r) => <Badge key={r} tone="messing">{ROLE_LABELS[r]}</Badge>)}
                  {m.status === "PASSIV" && <Badge>Passiv</Badge>}
                </div>
                {m.birthday && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-kreide-dim"><Cake size={13} aria-hidden /> {formatYmd(m.birthday).slice(0, 6)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
