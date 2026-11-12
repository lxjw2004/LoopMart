import { processNotificationJobs } from "./notifications.js";
import { createServer } from "node:http";
import { Pool } from "pg";
import { createAuth } from "../../auth/src/auth.js";
import { loadConfig } from "../../auth/src/config.js";
import { migrate } from "../../../packages/database/src/migrate.js";
import { createApp } from "./app.js";
const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseURL });
await migrate(pool);
const server = createServer(
  createApp({
    pool,
    auth: createAuth(config, pool),
    origin: config.trustedOrigins,
  }),
);
server.listen(
  Number(process.env.PORT || 3002),
  process.env.HOST || "127.0.0.1",
);
const jobs = setInterval(() => {
  void processNotificationJobs(pool).catch(console.error);
}, 5000);
jobs.unref();
