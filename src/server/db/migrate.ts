import path from "node:path";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb, isPgliteUrl } from "./client";

export async function runMigrations() {
  const url = process.env.DATABASE_URL ?? "";
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const db = getDb();
  if (isPgliteUrl(url)) {
    await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder });
  } else {
    await migratePostgres(db, { migrationsFolder });
  }
}
