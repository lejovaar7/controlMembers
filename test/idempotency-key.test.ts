import { afterEach, expect, it, vi } from "vitest";
import { createIdempotencyKey } from "../src/react-app/lib/idempotency-key";

afterEach(() => vi.unstubAllGlobals());

it("creates independent request keys on LAN browsers without crypto.randomUUID", () => {
	const getRandomValues = crypto.getRandomValues.bind(crypto);
	vi.stubGlobal("crypto", { getRandomValues });
	expect(crypto.randomUUID).toBeUndefined();
	const keys = Array.from({ length: 100 }, () => createIdempotencyKey());
	expect(new Set(keys).size).toBe(keys.length);
	for (const key of keys) expect(key).toMatch(/^[0-9a-f]{32}$/);
});
