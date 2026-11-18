import { sendEventReminders } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

/**
 * Täglicher Aufruf durch Vercel Cron (siehe vercel.json): Erinnerungen für die Termine von morgen.
 * Vercel schickt automatisch „Authorization: Bearer <CRON_SECRET>“, sobald CRON_SECRET in den
 * Umgebungsvariablen gesetzt ist. Ohne CRON_SECRET bleibt der Endpunkt gesperrt.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const result = await sendEventReminders();
  return Response.json(result);
}
