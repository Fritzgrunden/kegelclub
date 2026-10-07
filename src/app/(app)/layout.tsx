import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const { clubName } = await getSettings();
  return (
    <AppShell user={user} clubName={clubName}>
      {children}
    </AppShell>
  );
}
