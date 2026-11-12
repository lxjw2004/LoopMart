import { Pool } from "pg";
import { createManagedAccount } from "../apps/auth/src/admin.js";
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD)
  throw Error(
    "Set DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD explicitly. No default administrator is created.",
  );
const pool = new Pool({ connectionString: DATABASE_URL });
const c = await pool.connect();
try {
  await c.query("BEGIN");
  const user = await createManagedAccount(c as never, {
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: ADMIN_PASSWORD,
  });
  await c.query("INSERT INTO memberships(user_id,role) VALUES($1,'admin')", [
    user.id,
  ]);
  await c.query("COMMIT");
  console.log(
    "Administrator created. Email verification via configured SMTP is required before login.",
  );
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await pool.end();
}
