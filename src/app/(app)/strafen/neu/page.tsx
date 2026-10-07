import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { getEvent } from "@/server/services/events";
import { PenaltyFormLoader } from "@/components/penalties/penalty-form-page";
import { PageHeader } from "@/components/ui/page-header";
import { toYmd } from "@/lib/dates";

export const metadata: Metadata = { title: "Strafe eintragen" };

export default async function NewPenaltyPage({ searchParams }: { searchParams: Promise<{ mitglied?: string; termin?: string }> }) {
  await requirePermission("penalties:manage");
  const sp = await searchParams;
  const event = sp.termin ? await getEvent(sp.termin) : null;
  return (
    <>
      <PageHeader title="Strafe eintragen" back="/strafen" />
      <PenaltyFormLoader defaults={{ userId: sp.mitglied, eventId: event?.id ?? null, date: event ? toYmd(event.startsAt) : toYmd(new Date()) }} />
    </>
  );
}
