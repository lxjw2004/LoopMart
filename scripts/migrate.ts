import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "../apps/auth/src/auth.js";
import { loadConfig } from "../apps/auth/src/config.js";
import { migrate } from "../packages/database/src/migrate.js";
const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseURL });
try {
  const auth = createAuth(config, pool);
  await (await getMigrations(auth.options)).runMigrations();
  await migrate(pool);
  console.log("LoopMart database migrations completed.");
} finally {
  await pool.end();
}
