import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';

type Database = Pick<Pool, 'query'>;
const invalid = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
// Version-specific Better Auth 1.7.22 adapter boundary. The caller owns the transaction.
// This instance never exposes an HTTP handler or issues sessions. All adapter queries
// use the caller's checked-out connection; releasing it here would break audit atomicity.
async function managedContext(database: Database) {
  const connection = { query: database.query.bind(database), release() {} };
  const pool = { query: connection.query, connect: async () => connection, end: async () => {} };
  return betterAuth({
    secret: randomBytes(32).toString('hex'),
    baseURL: 'http://localhost:3001',
    database: pool as unknown as Pool,
    emailAndPassword: { enabled: true },
    user: { additionalFields: { banned: { type: 'boolean', defaultValue: false, input: false } } },
  }).$context;
}
function passwordValue(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    invalid('Password must contain 12–128 characters');
  return value as string;
}
export async function createManagedAccount(database: Database, body: Record<string, unknown>) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 100)
    invalid('Invalid account fields');
  const password = passwordValue(body.password);
  const context = await managedContext(database);
  const user = await context.internalAdapter.createUser({ email, name, emailVerified: false, banned: false }, { method: 'email-password' });
  await context.internalAdapter.linkAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password: await context.password.hash(password) });
  return { id: user.id, name: user.name, email: user.email, emailVerified: false, role: 'member' };
}
export async function setManagedPassword(database: Database, id: string, value: unknown) {
  const password = passwordValue(value);
  const context = await managedContext(database);
  const account = await context.internalAdapter.findCredentialAccount(id);
  if (!account) invalid('Credential account not found', 404);
  await context.internalAdapter.updatePassword(id, await context.password.hash(password));
  await context.internalAdapter.deleteUserSessions(id);
  return { ok: true };
}
