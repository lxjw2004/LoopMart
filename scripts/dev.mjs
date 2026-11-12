import { spawn } from "node:child_process";
const envFile = process.env.LOOPMART_ENV_FILE || ".env";
const production = process.env.LOOPMART_MODE === "production";
const jobs = [
  [
    "auth",
    ["--env-file=" + envFile, "--import", "tsx", "apps/auth/src/server.ts"],
    {},
  ],
  [
    "api",
    ["--env-file=" + envFile, "--import", "tsx", "apps/api/src/server.ts"],
    {},
  ],
  ...[
    ["web", "3000"],
    ["admin", "3004"],
  ].map(([name, port]) => [
    name,
    production
      ? [`apps/${name}/.next/standalone/apps/${name}/server.js`]
      : [
          "node_modules/next/dist/bin/next",
          "dev",
          `apps/${name}`,
          "--webpack",
          "--port",
          port,
          "--hostname",
          "127.0.0.1",
        ],
    { PORT: port, HOSTNAME: "127.0.0.1" },
  ]),
];
let stopping = false;
const children = [];
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}
for (const [name, args, extra] of jobs) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...extra },
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name}: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${name} exited ${code}`);
      stop(code || 1);
    }
  });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
