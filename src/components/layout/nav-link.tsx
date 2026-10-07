"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, CircleDot, CircleUser, Dices, Ellipsis, Gavel, House, PartyPopper, Settings, Trophy, Users,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { IconName } from "./nav-items";

const ICONS = { House, CircleDot, CalendarDays, Dices, Ellipsis, PartyPopper, Users, Trophy, Gavel, CircleUser, Settings };

const ACTIVE_ALIASES: Record<string, string[]> = {
  "/kegelabende": ["/kegelabende", "/termine", "/spielrunden"],
  "/mehr": ["/mehr", "/events", "/mitglieder", "/statistik", "/strafen", "/profil", "/verwaltung"],
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return (ACTIVE_ALIASES[href] ?? [href]).some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function SidebarLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  const pathname = usePathname();
  const active = href === "/kegelabende" ? isActive(pathname, href) : href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
        active ? "bg-messing/15 font-semibold text-messing-hell" : "text-kreide-dim hover:bg-theke-2 hover:text-kreide",
      )}
    >
      <Icon size={20} aria-hidden />
      {label}
    </Link>
  );
}

export function TabLink({ href, label, icon }: { href: string; label: string; icon: IconName }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
        active ? "text-messing-hell" : "text-kreide-dim",
      )}
    >
      <Icon size={24} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
      {label}
    </Link>
  );
}
