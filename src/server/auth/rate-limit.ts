import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Einfaches, datenbankgestütztes Fixed-Window-Rate-Limit.
 * Funktioniert auch serverless (Vercel), da kein Prozess-Speicher benötigt wird.
 * @returns true, wenn die Anfrage erlaubt ist.
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStartThreshold = new Date(Date.now() - windowMs);
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < ${windowStartThreshold.toISOString()}::timestamptz then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < ${windowStartThreshold.toISOString()}::timestamptz then now() else rate_limits.window_start end
    returning count
  `);
  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: { count: number }[] }).rows;
  return Number(list[0]?.count ?? 0) <= limit;
}

export async function resetRateLimit(key: string) {
  await db.execute(sql`delete from rate_limits where key = ${key}`);
}
