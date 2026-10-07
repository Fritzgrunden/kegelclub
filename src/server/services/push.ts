import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";
import { db } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema";
import { AppError } from "@/lib/errors";

export interface PushPayload {
  title: string;
  body: string;
  /** Seite, die beim Antippen der Benachrichtigung geöffnet wird. */
  url?: string;
}

interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Liefert den HTTP-Status des Push-Dienstes (201 = zugestellt, 404/410 = Abo abgelaufen). */
type PushSender = (sub: StoredSubscription, payload: string) => Promise<number>;

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

const webPushSender: PushSender = async (sub, payload) => {
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      {
        TTL: 24 * 60 * 60,
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || "mailto:kegelclub@example.org",
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
      },
    );
    return res.statusCode;
  } catch (error) {
    if (error instanceof webpush.WebPushError) return error.statusCode;
    throw error;
  }
};

let sender: PushSender = webPushSender;

/** Nur für Tests: Versand abfangen statt echte Push-Dienste aufzurufen. */
export function setPushSenderForTests(fn: PushSender | null) {
  sender = fn ?? webPushSender;
}

/* ───────────── Abos verwalten ───────────── */

/** Speichert das Abo eines Geräts. Meldet sich jemand anderes auf dem Gerät an, wechselt das Abo den Besitzer. */
export async function saveSubscription(userId: string, raw: unknown) {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Ungültiges Push-Abo.");
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: keys.p256dh, auth: keys.auth } });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/* ───────────── Versand ───────────── */

/**
 * Schickt eine Benachrichtigung an alle Geräte der genannten Benutzer.
 * Fehler werden nur geloggt – eine fehlgeschlagene Benachrichtigung darf nie die eigentliche Aktion abbrechen.
 * Gibt die Anzahl erfolgreich zugestellter Benachrichtigungen zurück.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0 || (sender === webPushSender && !vapidConfigured())) return 0;

  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const status = await sender(sub, body);
        if (status === 404 || status === 410) expired.push(sub.id);
        else if (status >= 200 && status < 300) delivered++;
        else console.error(`Push-Versand fehlgeschlagen (HTTP ${status}).`);
      } catch (error) {
        // z. B. ungültiger VAPID-Schlüssel/-Subject oder Netzwerkfehler (Meldungen enthalten keine Schlüssel)
        console.error("Push-Versand fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
      }
    }),
  );

  // Abgelaufene Abos (App deinstalliert, Berechtigung entzogen) aufräumen.
  if (expired.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired));
  return delivered;
}
