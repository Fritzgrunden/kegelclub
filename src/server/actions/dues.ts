"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { formatMonth } from "@/lib/dates";
import { parseEuroToCents } from "@/lib/format";
import {
  createDuesForMonth,
  deleteDues,
  markAllDuesPaidForMember,
  setDuesDefault,
  setDuesPaid,
  setMemberDuesAmounts,
} from "@/server/services/dues";
import { requireActor } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

export async function saveDuesSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const defaultCents = parseEuroToCents(str(fd, "amount") || "0");
    if (defaultCents === null) throw new AppError("Ungültiger Betrag.", "VALIDATION", { amount: "Bitte einen Betrag wie 5,00 eingeben." });

    // Felder „member:<id>“: leer = Standardbeitrag, sonst eigener Betrag (0 = beitragsfrei).
    const overrides: Record<string, number | null> = {};
    const fieldErrors: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith("member:") || typeof value !== "string") continue;
      const userId = key.slice("member:".length);
      const raw = value.trim();
      const cents = raw === "" ? null : parseEuroToCents(raw);
      if (raw !== "" && cents === null) fieldErrors[key] = "Ungültiger Betrag.";
      else overrides[userId] = cents;
    }
    if (Object.keys(fieldErrors).length) throw new AppError("Bitte die markierten Beträge prüfen.", "VALIDATION", fieldErrors);

    await setDuesDefault(actor, defaultCents);
    await setMemberDuesAmounts(actor, overrides);
    revalidatePath("/", "layout");
    return "Beitragshöhe gespeichert.";
  });
}

export async function createDuesForMonthAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const month = str(fd, "month");
    const n = await createDuesForMonth(actor, month);
    revalidatePath("/", "layout");
    return n === 1 ? `1 Beitrag für ${formatMonth(month)} angelegt.` : `${n} Beiträge für ${formatMonth(month)} angelegt.`;
  });
}

export async function toggleDuesPaidAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await setDuesPaid(actor, str(fd, "id"), str(fd, "paid") === "1");
    revalidatePath("/", "layout");
  });
}

export async function deleteDuesAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await deleteDues(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}

export async function markAllDuesPaidAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const n = await markAllDuesPaidForMember(actor, optStr(fd, "userId") ?? "");
    revalidatePath("/", "layout");
    return n === 1 ? "1 Beitrag als bezahlt markiert." : `${n} Beiträge als bezahlt markiert.`;
  });
}
