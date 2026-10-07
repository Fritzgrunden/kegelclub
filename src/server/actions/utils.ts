import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";
import type { ActionResult } from "@/lib/action-result";

/** Einheitliche Fehlerbehandlung für Server Actions. Interna (Stacktraces, SQL) gehen nie an den Client. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    unstable_rethrow(error); // redirect()/notFound() durchreichen
    if (error instanceof AppError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("Unerwarteter Fehler in Server Action:", error instanceof Error ? error.message : "unbekannt");
    return { ok: false, message: "Da ist etwas schiefgelaufen. Bitte versuche es erneut." };
  }
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function optStr(fd: FormData, key: string): string | undefined {
  const v = str(fd, key).trim();
  return v === "" ? undefined : v;
}

export function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}
