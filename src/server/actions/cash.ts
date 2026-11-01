"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { parseEuroToCents } from "@/lib/format";
import { createCashEntry, deleteCashEntry } from "@/server/services/cash";
import { requireActor } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

export async function saveCashEntryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const amountCents = parseEuroToCents(str(fd, "amount"));
    if (amountCents === null) throw new AppError("Ungültiger Betrag.", "VALIDATION", { amount: "Bitte einen Betrag wie 15,00 eingeben." });
    const kind = str(fd, "kind");
    await createCashEntry(actor, {
      kind,
      amountCents,
      description: str(fd, "description"),
      date: str(fd, "date"),
      paidByUserId: kind === "AUSGABE" ? (optStr(fd, "paidByUserId") ?? null) : null,
    });
    revalidatePath("/", "layout");
    return kind === "EINNAHME" ? "Einnahme eingetragen." : "Ausgabe eingetragen.";
  });
}

export async function deleteCashEntryAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await deleteCashEntry(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}
