import { test } from "node:test";
import assert from "node:assert/strict";
import { itemFilterClauses } from "./item-filters.js";

test("item filters bind inclusive prices and enumerated attributes after existing arguments", () => {
  const args: unknown[] = ["existing"];
  const sql = itemFilterClauses(new URLSearchParams("minPriceCents=0&maxPriceCents=1200&condition=good&deliveryMethod=pickup"), args);
  assert.deepEqual(args, ["existing", 0, 1200, "good", "pickup"]);
  assert.equal(sql, " AND (e.data->>'priceCents')::bigint >= $2 AND (e.data->>'priceCents')::bigint <= $3 AND e.data->>'condition' = $4 AND e.data->>'deliveryMethod' = $5");
});
test("absent and empty item filters add no conditions", () => {
  const args: unknown[] = [];
  assert.equal(itemFilterClauses(new URLSearchParams("minPriceCents=&condition="), args), "");
  assert.deepEqual(args, []);
});
test("all existing condition and delivery enums are accepted", () => {
  for (const condition of ["new", "like_new", "good", "fair"])
    for (const deliveryMethod of ["pickup", "meetup", "delivery"]) {
      const args: unknown[] = [];
      itemFilterClauses(new URLSearchParams({ condition, deliveryMethod }), args);
      assert.deepEqual(args, [condition, deliveryMethod]);
    }
});
test("invalid amounts, reversed ranges, enums and repeated filters fail with 400", () => {
  for (const query of ["minPriceCents=-1", "maxPriceCents=1.2", "minPriceCents=1e2", "minPriceCents= 1", "minPriceCents=9007199254740992", "minPriceCents=20&maxPriceCents=10", "condition=broken", "deliveryMethod=ship", "condition=good%27%3BSELECT", "minPriceCents=1&minPriceCents=2"]) {
    assert.throws(() => itemFilterClauses(new URLSearchParams(query), []), (error: any) => error.status === 400, query);
  }
});
test("trusted row alias is restricted to an SQL identifier", () => {
  assert.match(itemFilterClauses(new URLSearchParams("maxPriceCents=0"), [], "item"), /item.data/);
  assert.throws(() => itemFilterClauses(new URLSearchParams("maxPriceCents=0"), [], "e;DROP TABLE entities"));
});
