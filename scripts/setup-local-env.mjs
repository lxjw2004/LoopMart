import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env") || existsSync(".env.test"))
  throw Error(
    "Environment files already exist; no files overwritten. Review them manually.",
  );
const password = randomBytes(24).toString("hex");
for (const [file, port, name] of [
  [".env", 5432, "loopmart"],
  [".env.test", 5433, "loopmart_test"],
]) {
  const url = `postgresql://loopmart:${password}@127.0.0.1:${port}/${name}`;
  writeFileSync(
    file,
    `DATABASE_URL=${url}\n${file === ".env.test" ? `TEST_DATABASE_URL=${url}\n` : ""}POSTGRES_PASSWORD=${password}\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nBETTER_AUTH_URL=http://localhost:3001\nTRUSTED_ORIGINS=http://localhost:3000,http://localhost:3004\nALLOWED_EMAIL_DOMAINS=purdue.edu\nSMTP_URL=\nMAIL_FROM=\n`,
    { mode: 0o600 },
  );
}
console.log(
  "Created private local development and test configuration. SMTP remains empty.",
);
