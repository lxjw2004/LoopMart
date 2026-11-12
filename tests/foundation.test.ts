import { test } from "node:test";
import assert from "node:assert/strict";
import { emailAllowed } from "../packages/contracts/src/email-policy.js";
import { assertMember } from "../packages/contracts/src/permissions.js";
import { createMailSender } from "../packages/integrations/src/mail.js";
test("exact school domain and normalized casing", () => {
  assert.equal(emailAllowed("Student@PURDUE.EDU"), true);
  for (const email of [
    "x@evilpurdue.edu",
    "x@purdue.edu.evil",
    "x@sub.purdue.edu",
    "x@@purdue.edu",
    " x@purdue.edu",
  ])
    assert.equal(emailAllowed(email), false);
  assert.equal(emailAllowed("x@other.edu", ["other.edu"]), true);
});
test("membership fails closed", () => {
  for (const actor of [
    null,
    { id: "1", emailVerified: false, banned: false },
    { id: "1", emailVerified: true, banned: true },
  ])
    assert.throws(() => assertMember(actor));
  assert.doesNotThrow(() =>
    assertMember({ id: "1", emailVerified: true, banned: false }),
  );
});
test("empty SMTP rejects without token in error", async () => {
  const send = createMailSender({});
  await assert.rejects(
    send({ to: "x@purdue.edu", subject: "Verify", text: "secret-token" }),
    (error: Error) =>
      !error.message.includes("secret-token") &&
      error.message === "Mail delivery is not configured",
  );
});
import { loadConfig } from "../apps/auth/src/config.js";
test("configuration rejects unsafe origin and missing secrets", () => {
  assert.throws(() => loadConfig({}));
  const env = {
    BETTER_AUTH_SECRET: "x".repeat(48),
    DATABASE_URL: "postgresql://localhost/loopmart",
    BETTER_AUTH_URL: "http://evil.test",
  };
  assert.throws(() => loadConfig(env));
  assert.equal(
    loadConfig({ ...env, BETTER_AUTH_URL: "http://localhost:3001" }).domains[0],
    "purdue.edu",
  );
});
import { requireMember } from "../apps/auth/src/member.js";
test("existing sessions reload current membership", async () => {
  const auth = { api: { getSession: async () => ({ user: { id: "1" } }) } };
  const db = {
    query: async () => ({
      rows: [{ id: "1", emailVerified: true, banned: true }],
    }),
  };
  await assert.rejects(
    requireMember(auth, db as never, new Headers()),
    /membership/,
  );
});
import { unavailableWithoutMail } from "../apps/auth/src/request-policy.js";
test("reset availability never depends on account identity", () => {
  for (const email of ["known@purdue.edu", "unknown@purdue.edu"])
    assert.equal(
      unavailableWithoutMail(
        "/api/auth/request-password-reset?email=" + email,
        false,
      ),
      true,
    );
  assert.equal(
    unavailableWithoutMail("/api/auth/request-password-reset", true),
    false,
  );
});
