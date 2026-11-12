import test from "node:test";
import assert from "node:assert/strict";
import { isolatedTestDatabaseURL } from "./test-database.js";
test("integration harness accepts only the isolated local test database", () => {
  assert.equal(isolatedTestDatabaseURL(undefined), undefined);
  const local = "postgresql://tester:local@127.0.0.1:5433/loopmart_test";
  assert.equal(isolatedTestDatabaseURL(local), local);
  for (const url of [
    "postgresql://localhost:5432/loopmart",
    "postgresql://server.example/loopmart_test",
    "https://localhost/loopmart_test",
    "postgresql://localhost:5432/loopmart_test",
    "postgresql://localhost:5433/loopmart_test?host=server.example",
    "invalid",
  ])
    assert.throws(() => isolatedTestDatabaseURL(url));
});
