import { spawnSync } from "node:child_process";
const binary = process.env.DOCKER_BIN || "docker";
const database = new URL(process.env.TEST_DATABASE_URL || "");
if (database.hostname !== "127.0.0.1" || database.pathname !== "/loopmart_test")
  throw Error("Image smoke requires local isolated test database");
database.hostname = "postgres-test";
database.port = "5432";
const env = {
  ...process.env,
  DATABASE_URL: database.href,
  BETTER_AUTH_URL: "http://localhost:13051",
  TRUSTED_ORIGINS: "http://localhost:13050,http://localhost:13054",
};
const names = [];
function docker(args, ignore = false) {
  const r = spawnSync(binary, args, { env, encoding: "utf8" });
  if (r.status && !ignore) throw Error(r.stderr || "Docker command failed");
  return r.stdout.trim();
}
try {
  for (const [name, alias, port, internal, command] of [
    ["auth", "auth", 13051, 3001, ["node", "dist/apps/auth/src/server.js"]],
    ["api", "api", 13052, 3002, ["node", "dist/apps/api/src/server.js"]],
    [
      "web",
      "web",
      13050,
      3000,
      ["node", "apps/web/.next/standalone/apps/web/server.js"],
    ],
    [
      "admin",
      "admin",
      13054,
      3004,
      ["node", "apps/admin/.next/standalone/apps/admin/server.js"],
    ],
  ]) {
    const id = `loopmart-smoke-${name}`;
    docker([
      "run",
      "--detach",
      "--rm",
      "--name",
      id,
      "--network",
      "loopmart-local_default",
      "--network-alias",
      alias,
      "--memory",
      "768m",
      "--cpus",
      "1",
      "--publish",
      `127.0.0.1:${port}:${internal}`,
      "--env-file",
      ".env.test",
      "-e",
      "DATABASE_URL",
      "-e",
      "BETTER_AUTH_URL",
      "-e",
      "TRUSTED_ORIGINS",
      "-e",
      "HOSTNAME=0.0.0.0",
      "-e",
      `PORT=${internal}`,
      "loopmart:local-verification",
      ...command,
    ]);
    names.push(id);
  }
  for (const [port, path] of [
    [13050, "/"],
    [13054, "/"],
    [13051, "/api/auth/get-session"],
    [13050, "/api/v1/public/settings"],
    [13054, "/api/v1/public/settings"],
  ]) {
    let success = false;
    for (let n = 0; n < 40; n++) {
      try {
        const r = await fetch(`http://localhost:${port}${path}`);
        if (r.ok) {
          if (path === "/") {
            const html = await r.text();
            if (!html.includes("LoopMart"))
              throw Error("Missing application HTML");
            const css = html.match(/href="([^" ]+\.css(?:\?[^" ]*)?)"/);
            if (css && !(await fetch(`http://localhost:${port}${css[1]}`)).ok)
              throw Error("Standalone CSS unavailable");
          }
          success = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!success) throw Error(`Image endpoint failed ${port}${path}`);
  }
  console.log(
    "Linux ARM64 image: auth/API/Web/Admin startup, proxy settings and standalone CSS smoke passed.",
  );
} finally {
  for (const name of names.reverse()) docker(["stop", name], true);
}
