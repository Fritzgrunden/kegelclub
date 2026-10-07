import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getPenalty } from "@/server/services/penalties";
import { PenaltyFormLoader } from "@/components/penalties/penalty-form-page";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Strafe bearbeiten" };

export default async function EditPenaltyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("penalties:manage");
  const p = await getPenalty((await params).id);
  if (!p) notFound();
  return (
    <>
      <PageHeader title="Strafe bearbeiten" back="/strafen" />
      <PenaltyFormLoader defaults={{ id: p.id, userId: p.userId, penaltyTypeId: p.penaltyTypeId, customLabel: p.customLabel, amountCents: p.amountCents, date: p.date, eventId: p.eventId, comment: p.comment }} />
    </>
  );
}
