import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Beide Treiber (postgres.js und PGlite) bieten dieselbe Drizzle-Query-API.
 * Als gemeinsamer Typ wird der postgres.js-Typ verwendet.
 */
export type DB = PostgresJsDatabase<typeof schema>;

type Holder = { db?: DB; pglite?: PGlite; url?: string };
const globalHolder = globalThis as unknown as { __kegelDb?: Holder };
const holder: Holder = (globalHolder.__kegelDb ??= {});

export function isPgliteUrl(url: string) {
  return url.startsWith("pglite://");
}

export function createDb(url: string): { db: DB; pglite?: PGlite } {
  if (isPgliteUrl(url)) {
    const target = url.slice("pglite://".length);
    const pglite = target === "memory" ? new PGlite() : new PGlite(target);
    return { db: drizzlePglite(pglite, { schema }) as unknown as DB, pglite };
  }
  // Auf Vercel bewusst nur eine Verbindung: postgres.js bündelt parallele Abfragen (Pipelining) darüber,
  // das ist schneller als der Aufbau weiterer Verbindungen (je ~250 ms).
  const client = postgres(url, { max: process.env.VERCEL ? 1 : 10, prepare: false });
  return { db: drizzlePostgres(client, { schema }) };
}

export function getDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt (siehe .env.example).");
  if (!holder.db || holder.url !== url) {
    const created = createDb(url);
    holder.db = created.db;
    holder.pglite = created.pglite;
    holder.url = url;
  }
  return holder.db;
}

/** Nur für Tests: Verbindung verwerfen. */
export async function resetDbConnection() {
  await holder.pglite?.close();
  holder.db = undefined;
  holder.pglite = undefined;
  holder.url = undefined;
}

/** Lazy-Proxy, damit Module `db` importieren können, ohne beim Import eine Verbindung aufzubauen. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});
