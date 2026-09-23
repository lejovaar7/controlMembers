import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommission, plans } from "./calculator.mjs";

test("recurring commission uses the same paying portfolio for twelve months", () => {
	assert.deepEqual(calculateCommission(99900, 30, 10), { perClient: 29970, monthly: 299700, annual: 3596400, revenue: 999000 });
});
test("all price scenarios calculate the proposed commission", () => {
	assert.deepEqual(plans.map((plan) => calculateCommission(plan.price, 30, 1).monthly), [29970, 44970, 59970]);
	assert.equal(calculateCommission(99900, 30, 30).monthly, 899100);
});
test("zero and maximum inputs remain valid", () => {
	assert.equal(calculateCommission(99900, 30, 0).annual, 0);
	assert.equal(calculateCommission(99900, 0, 10).monthly, 0);
	assert.equal(calculateCommission(199900, 100, 10000).monthly, 1999000000);
});
test("invalid and non-finite inputs cannot create misleading projections", () => {
	for (const input of [[99900, -1, 10], [99900, 101, 10], [99900, NaN, 10], [99900, 30, -1], [99900, 30, 1.5], [99900, 30, 10001], [99900, 30, Infinity], [-1, 30, 10]]) {
		assert.throws(() => calculateCommission(...input), RangeError);
	}
});
