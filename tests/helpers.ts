import { inArray, not, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/server/db/client";
import { profiles, roles as rolesTable, userRoles, users, type Role, type UserStatus } from "@/server/db/schema";
import { loadPermissions } from "@/server/services/roles";
import type { Actor } from "@/server/auth/types";

const FAST_HASH = bcrypt.hashSync("Testpasswort123", 4);
export const TEST_PASSWORD = "Testpasswort123";

let counter = 0;

export async function createTestUser(opts: { roles?: Role[]; status?: UserStatus; firstName?: string } = {}): Promise<Actor & { email: string }> {
  const db = getDb();
  counter++;
  const email = `test${counter}@demo.test`;
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: FAST_HASH, status: opts.status ?? "AKTIV" })
    .returning({ id: users.id });
  await db.insert(profiles).values({ userId: user.id, firstName: opts.firstName ?? `Test${counter}`, lastName: "Demo" });
  const roles: Role[] = Array.from(new Set<Role>(["MITGLIED", ...(opts.roles ?? [])]));
  await db.insert(userRoles).values(roles.map((role) => ({ userId: user.id, role })));
  return { id: user.id, permissions: await loadPermissions(user.id), email };
}

/** Rollen aus der Migration – nach jedem Test wiederhergestellt, weil Tests Rechte ändern. */
let seededRoles: (typeof rolesTable.$inferSelect)[] | null = null;

async function resetRoles() {
  const db = getDb();
  seededRoles ??= await db.select().from(rolesTable);
  await db.delete(rolesTable).where(not(inArray(rolesTable.key, seededRoles.map((r) => r.key))));
  for (const r of seededRoles) await db.insert(rolesTable).values(r).onConflictDoUpdate({ target: rolesTable.key, set: r });
}

export async function truncateAll() {
  await resetRoles();
  await getDb().execute(sql`
    truncate table dues, push_subscriptions, penalties, penalty_types, game_results, game_sessions, game_rules, games,
      event_participations, events, event_series, password_reset_tokens, sessions, rate_limits,
      user_roles, profiles, images, users, settings restart identity cascade
  `);
}
