// Lädt `.env` für CLI-Skripte (Next.js lädt sie selbst).
import fs from "node:fs";
import path from "node:path";

// `--prod` (npm run db:migrate:prod): nur die Live-Datenbank aus `.env.live`, nie `.env`.
const prod = process.argv.includes("--prod");
if (prod && !fs.existsSync(path.resolve(process.cwd(), ".env.live"))) {
  console.error("✖ .env.live fehlt – dort DATABASE_URL der Live-Datenbank eintragen.");
  process.exit(1);
}

for (const file of prod ? [".env.live"] : [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || (!prod && process.env[m[1]] !== undefined)) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL ?? "";
if (url.startsWith("pglite://") && url !== "pglite://memory") {
  fs.mkdirSync(path.dirname(path.resolve(url.slice("pglite://".length))), { recursive: true });
}
