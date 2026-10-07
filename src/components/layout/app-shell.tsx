import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/types";
import { logoutAction } from "@/server/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { PinDiamond } from "@/components/ui/pin-diamond";
import { NAV_ITEMS } from "./nav-items";
import { SidebarLink, TabLink } from "./nav-link";

export function AppShell({ user, clubName, children }: { user: SessionUser; clubName: string; children: ReactNode }) {
  const items = NAV_ITEMS.filter((i) => !i.permission || hasPermission(user, i.permission));
  const tabs = items.filter((i) => i.mobileTab);

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[264px_1fr]">
      {/* Desktop-Sidebar */}
      <aside className="holzleiste sticky top-0 hidden h-dvh flex-col border-r border-eiche/70 px-4 py-5 lg:flex">
        <Link href="/" className="mb-7 flex items-center gap-3 px-2">
          <PinDiamond className="size-10" />
          <span className="font-display text-lg font-bold leading-tight">{clubName}</span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((i) => (
            <SidebarLink key={i.href} href={i.href} label={i.label} icon={i.icon} />
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-3 border-t border-eiche/60 pt-4">
          <Link href="/profil" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar person={user} size="md" />
            <span className="truncate text-sm font-medium">{user.displayName}</span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex size-11 items-center justify-center rounded-xl text-kreide-dim hover:bg-theke-2 hover:text-kreide" aria-label="Abmelden">
              <LogOut size={20} />
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile Kopfzeile */}
        <header className="holzleiste sticky top-0 z-20 flex items-center justify-between border-b border-eiche/70 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <PinDiamond className="size-8" />
            <span className="font-display text-[17px] font-bold">{clubName}</span>
          </Link>
          <Link href="/profil" aria-label="Mein Profil" className="flex min-h-11 items-center">
            <Avatar person={user} size="sm" />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

        {/* Mobile Tab-Leiste */}
        <nav
          aria-label="Hauptnavigation"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-eiche bg-theke/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {tabs.map((t) => (
            <TabLink key={t.href} href={t.href} label={t.label === "Kegelabende" ? "Kegeln" : t.label} icon={t.icon} />
          ))}
          <TabLink href="/mehr" label="Mehr" icon="Ellipsis" />
        </nav>
      </div>
    </div>
  );
}
