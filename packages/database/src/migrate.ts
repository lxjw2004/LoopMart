import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
export async function migrate(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(921174)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS business_migrations(version integer PRIMARY KEY)",
    );
    for (const [version, file] of [
      [1, "001-business.sql"],
      [2, "002-isolation-audit.sql"],
      [3, "003-contact-processing.sql"],
    ] as const) {
      if (
        !(
          await c.query("SELECT 1 FROM business_migrations WHERE version=$1", [
            version,
          ])
        ).rowCount
      ) {
        await c.query(
          await readFile(
            new URL("../migrations/" + file, import.meta.url),
            "utf8",
          ),
        );
        await c.query("INSERT INTO business_migrations VALUES($1)", [version]);
      }
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
