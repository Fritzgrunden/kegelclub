import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { EventListPage } from "@/components/events/event-list-page";

export const metadata: Metadata = { title: "Kegelabende" };

export default async function Page({ searchParams }: { searchParams: Promise<{ zeit?: string }> }) {
  const user = await requireUser();
  const { zeit } = await searchParams;
  return <EventListPage user={user} kind="KEGELABEND" past={zeit === "vergangen"} basePath="/kegelabende" />;
}
