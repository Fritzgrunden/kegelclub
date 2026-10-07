import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { addDaysYmd, toYmd } from "@/lib/dates";

export const metadata: Metadata = { title: "Neuer Termin" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ art?: string }> }) {
  await requirePermission("events:manage");
  const { art } = await searchParams;
  const kind = art === "EVENT" ? "EVENT" : "KEGELABEND";
  const settings = await getSettings();
  return (
    <>
      <PageHeader title={kind === "KEGELABEND" ? "Neuer Kegelabend" : "Neues Event"} back={kind === "KEGELABEND" ? "/kegelabende" : "/events"} />
      <Card className="max-w-2xl">
        <EventForm
          kind={kind}
          defaults={{
            title: kind === "KEGELABEND" ? "Kegelabend" : "",
            date: addDaysYmd(toYmd(new Date()), 7),
            time: kind === "KEGELABEND" ? settings.defaultTime : "18:00",
            location: kind === "KEGELABEND" ? settings.defaultLocation : "",
          }}
        />
      </Card>
    </>
  );
}
