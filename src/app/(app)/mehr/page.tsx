import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight, CircleUser, PartyPopper, Settings, Trophy, Users, LogOut, Wallet } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/auth";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mehr" };

export default async function MorePage() {
  const user = await requireUser();
  const links = [
    { href: "/kalender", label: "Kalender", text: "Alle Termine im Monatsüberblick", Icon: CalendarDays },
    { href: "/events", label: "Events", text: "Kegeltour, Feiern & Ausflüge", Icon: PartyPopper },
    { href: "/mitglieder", label: "Mitglieder", text: "Alle aus dem Club", Icon: Users },
    { href: "/statistik", label: "Rangliste & Statistik", text: "Wer liegt vorn?", Icon: Trophy },
    ...(hasPermission(user, "dues:view-own") || hasPermission(user, "dues:view-all")
      ? [{ href: "/beitraege", label: hasPermission(user, "dues:manage") ? "Beiträge verwalten" : "Meine Beiträge", text: "Monatsbeiträge", Icon: Wallet }]
      : []),
    { href: "/profil", label: "Mein Profil", text: "Daten, Foto, Passwort", Icon: CircleUser },
    ...(hasPermission(user, "members:manage") ? [{ href: "/verwaltung", label: "Verwaltung", text: "Mitglieder, Rollen, Einstellungen", Icon: Settings }] : []),
  ];
  return (
    <>
      <PageHeader title="Mehr" />
      <ul className="overflow-hidden rounded-2xl border border-eiche bg-theke">
        {links.map(({ href, label, text, Icon }) => (
          <li key={href} className="border-b border-eiche/60 last:border-0">
            <Link href={href} className="flex min-h-16 items-center gap-4 px-4 hover:bg-theke-2">
              <Icon size={22} className="text-messing" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-kreide-dim">{text}</span>
              </span>
              <ChevronRight size={20} className="text-kreide-dim" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction} className="mt-6">
        <button type="submit" className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-eiche text-kreide-dim hover:text-kreide">
          <LogOut size={20} aria-hidden /> Abmelden
        </button>
      </form>
    </>
  );
}
