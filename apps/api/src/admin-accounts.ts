import type { Pool } from "pg";
import {
  createManagedAccount,
  setManagedPassword,
} from "../../auth/src/admin.js";
export async function createAccount(pool: Pool, body: Record<string, unknown>) {
  const user = await createManagedAccount(pool, body);
  await pool.query("INSERT INTO memberships(user_id) VALUES($1)", [user.id]);
  return user;
}
export async function replacePassword(
  pool: Pool,
  id: string,
  password: unknown,
) {
  return setManagedPassword(pool, id, password);
}
