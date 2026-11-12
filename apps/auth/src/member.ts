import type { Pool } from "pg";
import { assertMember } from "../../../packages/contracts/src/permissions.js";
type SessionReader = {
  api: {
    getSession(input: {
      headers: Headers;
    }): Promise<{ user: { id: string } } | null>;
  };
};
// Always reload authorization state: a still-valid session is identity, not membership.
export async function requireMember(
  auth: SessionReader,
  database: Pick<Pool, "query">,
  headers: Headers,
) {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Authentication required");
  const result = await database.query(
    'SELECT id, "emailVerified", banned FROM "user" WHERE id = $1',
    [session.user.id],
  );
  const actor: unknown = result.rows[0];
  assertMember(actor);
  return actor;
}
