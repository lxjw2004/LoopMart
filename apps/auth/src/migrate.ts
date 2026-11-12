import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { createAuth } from "./auth.js";
const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseURL });
try {
  const { runMigrations } = await getMigrations(
    createAuth(config, pool).options,
  );
  await runMigrations();
} finally {
  await pool.end();
}
