import "./load-env";
import { runMigrations } from "../src/server/db/migrate";
import { resetDbConnection } from "../src/server/db/client";

runMigrations()
  .then(async () => {
    console.log("✔ Migrationen ausgeführt.");
    await resetDbConnection();
    process.exit(0);
  })
  .catch((err) => {
    console.error("✖ Migration fehlgeschlagen:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
