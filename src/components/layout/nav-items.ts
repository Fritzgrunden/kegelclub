import type { Permission } from "@/lib/permissions";

export type IconName =
  | "House" | "CircleDot" | "CalendarDays" | "Dices" | "Ellipsis" | "PartyPopper" | "Users"
  | "Trophy" | "Gavel" | "CircleUser" | "Settings";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  permission?: Permission;
  /** In der mobilen Tab-Leiste anzeigen */
  mobileTab?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: "House", mobileTab: true },
  { href: "/kegelabende", label: "Kegelabende", icon: "CircleDot", mobileTab: true },
  { href: "/kalender", label: "Kalender", icon: "CalendarDays", mobileTab: true },
  { href: "/spiele", label: "Spiele", icon: "Dices", mobileTab: true },
  { href: "/events", label: "Events", icon: "PartyPopper" },
  { href: "/mitglieder", label: "Mitglieder", icon: "Users" },
  { href: "/statistik", label: "Rangliste", icon: "Trophy" },
  { href: "/strafen", label: "Strafen", icon: "Gavel" },
  { href: "/profil", label: "Profil", icon: "CircleUser" },
  { href: "/verwaltung", label: "Verwaltung", icon: "Settings", permission: "members:manage" },
];
