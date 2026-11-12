import test from "node:test";
import assert from "node:assert/strict";
import { dollarsToCents, centsToDollars, usd } from "./money.js";
test("USD decimal conversion preserves exact cents", () => {
  assert.equal(dollarsToCents("0.29"), 29);
  assert.equal(dollarsToCents("12.3"), 1230);
  assert.equal(dollarsToCents("0"), 0);
  assert.equal(centsToDollars(29), "0.29");
  assert.equal(usd(29), "$0.29");
});
test("rejects fractional cents, exponent, negatives and unsafe amounts", () => {
  for (const value of ["0.291", "1e3", "-1", "NaN", "90071992547409.92"])
    assert.throws(() => dollarsToCents(value));
});
