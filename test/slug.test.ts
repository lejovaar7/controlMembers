import { describe, expect, it } from "vitest";
import { slugify } from "../src/react-app/lib/slug";

describe("slugify", () => {
	it("normalises names predictably", () => {
		expect(slugify("Acme Wash")).toBe("acme-wash");
		expect(slugify("  Acme   Wash  ")).toBe("acme-wash");
		expect(slugify("Café Münster")).toBe("cafe-munster");
		expect(slugify("Acme & Co. #1")).toBe("acme-co-1");
	});

	it("never produces an empty or unsafe slug", () => {
		expect(slugify("***")).toBe("organization");
		expect(slugify("")).toBe("organization");
		expect(slugify("a".repeat(200))).toHaveLength(48);
		expect(slugify("Acme/../etc")).toBe("acme-etc");
	});
});
