import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "../../apps/auth/src/auth.js";
import { loadConfig } from "../../apps/auth/src/config.js";
import { migrate } from "../../packages/database/src/migrate.js";
const databaseURL = process.env.TEST_DATABASE_URL;
if (
  !databaseURL ||
  new URL(databaseURL).pathname !== "/loopmart_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseURL).hostname)
)
  throw Error(
    "Browser fixtures require the isolated local loopmart_test database",
  );
const pool = new Pool({ connectionString: databaseURL });
const config = loadConfig({ ...process.env, DATABASE_URL: databaseURL });
const inbox: { to: string; text: string }[] = [];
const auth = createAuth(config, pool, async (message) => {
  inbox.push(message);
});
try {
  await (await getMigrations(auth.options)).runMigrations();
  await migrate(pool);
  const users = [];
  for (const role of ["admin", "member", "member"]) {
    const email = `browser-${randomUUID()}@purdue.edu`,
      password = randomBytes(24).toString("base64url");
    const response = await auth.handler(
      new Request("http://localhost:3001/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: role === "admin" ? "测试管理员" : "测试用户",
        }),
      }),
    );
    if (!response.ok) throw Error("Fixture signup failed");
    await auth.handler(new Request(inbox.find((m) => m.to === email)!.text));
    const user = (
      await pool.query('SELECT id FROM "user" WHERE email=$1', [email])
    ).rows[0];
    await pool.query(
      "INSERT INTO memberships(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role",
      [user.id, role],
    );
    users.push({ id: user.id, email, password, role });
  }
  await mkdir(".superpowers/e2e", { recursive: true });
  await writeFile(".superpowers/e2e/users.json", JSON.stringify(users), {
    mode: 0o600,
  });
  console.log(
    "Created three verified isolated browser-test identities; credentials stored privately.",
  );
} finally {
  await pool.end();
}
