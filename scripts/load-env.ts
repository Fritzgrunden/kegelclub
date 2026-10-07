// Lädt `.env` für CLI-Skripte (Next.js lädt sie selbst).
import fs from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.DATABASE_URL ?? "";
if (url.startsWith("pglite://") && url !== "pglite://memory") {
  fs.mkdirSync(path.dirname(path.resolve(url.slice("pglite://".length))), { recursive: true });
}
