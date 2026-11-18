import { hasPermission, type Permission } from "@/lib/permissions";
import type { TabItem } from "@/components/ui/tabs";

/**
 * Hauptreiter des Geld-Bereichs („Kasse“ in der Tab-Leiste): Strafen, Beiträge, Kassenbuch.
 * Alles rund ums Geld an einer Stelle, statt Beiträge versteckt unter „Mehr“.
 */
export function moneyTabs(user: { permissions: readonly Permission[] }, active: "strafen" | "beitraege" | "kasse"): TabItem[] {
  const dues = hasPermission(user, "dues:view-own") || hasPermission(user, "dues:view-all");
  return [
    { href: "/strafen", label: "Strafen", active: active === "strafen" },
    ...(dues ? [{ href: "/beitraege", label: "Beiträge", active: active === "beitraege" }] : []),
    ...(hasPermission(user, "cash:view") ? [{ href: "/strafen?ansicht=kasse", label: "Kasse", active: active === "kasse" }] : []),
  ];
}
