import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getEvent } from "@/server/services/events";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { toHm, toYmd } from "@/lib/dates";

export const metadata: Metadata = { title: "Termin bearbeiten" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("events:manage");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return (
    <>
      <PageHeader title="Termin bearbeiten" back={`/termine/${id}`} />
      <Card className="max-w-2xl">
        <EventForm
          kind={event.kind}
          isSeries={Boolean(event.series)}
          defaults={{
            id: event.id,
            title: event.title,
            eventType: event.eventType,
            description: event.description,
            location: event.location,
            date: toYmd(event.startsAt),
            time: toHm(event.startsAt),
            endDate: event.endsAt ? toYmd(event.endsAt) : null,
            endTime: event.endsAt ? toHm(event.endsAt) : null,
            seriesEndDate: event.series?.endDate ?? null,
          }}
        />
      </Card>
    </>
  );
}
