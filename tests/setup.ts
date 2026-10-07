import { afterAll, beforeAll } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { resetDbConnection } from "@/server/db/client";

// Jede Testdatei erhält eine frische In-Memory-PostgreSQL-Instanz (PGlite).
process.env.DATABASE_URL = "pglite://memory";

beforeAll(async () => {
  await resetDbConnection();
  await runMigrations();
});

afterAll(async () => {
  await resetDbConnection();
});
