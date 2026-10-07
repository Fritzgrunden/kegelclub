/**
 * Legt den ersten Administrator an oder befördert ein bestehendes Konto zum Admin.
 *   npm run admin:create
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create   (nicht-interaktiv, z. B. für CI)
 */
import "./load-env";
import readline from "node:readline";
import { eq } from "drizzle-orm";
import { getDb, resetDbConnection } from "../src/server/db/client";
import { profiles, userRoles, users } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/crypto";
import { emailSchema, passwordSchema } from "../src/lib/validation";

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Passwort-Eingabe nicht anzeigen
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(s);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    }),
  );
}

async function main() {
  const db = getDb();
  const email = emailSchema.parse(process.env.ADMIN_EMAIL || (await ask("E-Mail des Admins: ")));
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    await db.update(users).set({ status: "AKTIV" }).where(eq(users.id, existing.id));
    await db.insert(userRoles).values({ userId: existing.id, role: "ADMIN" }).onConflictDoNothing();
    console.log(`✔ ${email} ist jetzt Admin (Passwort unverändert).`);
    return;
  }

  const firstName = process.env.ADMIN_FIRST_NAME || (await ask("Vorname: ")) || "Admin";
  const lastName = process.env.ADMIN_LAST_NAME || (await ask("Nachname: ")) || "Kegelclub";
  const password = process.env.ADMIN_PASSWORD || (await ask("Passwort (mind. 10 Zeichen): ", true));
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const passwordHash = await hashPassword(parsed.data);
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, passwordHash, status: "AKTIV" }).returning({ id: users.id });
    await tx.insert(profiles).values({ userId: u.id, firstName, lastName });
    await tx.insert(userRoles).values([
      { userId: u.id, role: "MITGLIED" },
      { userId: u.id, role: "ADMIN" },
    ]);
  });
  console.log(`✔ Admin ${email} angelegt. Du kannst dich jetzt anmelden.`);
}

main()
  .then(() => resetDbConnection())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✖", e instanceof Error ? e.message : e);
    await resetDbConnection();
    process.exit(1);
  });
