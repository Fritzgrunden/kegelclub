import type { ReactNode } from "react";
import { PinDiamond } from "@/components/ui/pin-diamond";
import { getSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { clubName } = await getSettings();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <PinDiamond className="size-12" />
        <div>
          <p className="font-display text-2xl font-bold leading-tight">{clubName}</p>
          <p className="text-sm text-kreide-dim">Vereins-App</p>
        </div>
      </div>
      <div className="rounded-2xl border border-eiche bg-theke p-5 sm:p-6">{children}</div>
    </main>
  );
}
