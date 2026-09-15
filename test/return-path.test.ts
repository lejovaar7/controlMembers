import { describe, expect, it } from "vitest";
import {
	DEFAULT_RETURN_PATH,
	safeReturnPath,
} from "../src/react-app/lib/return-path";
import { authenticatedStartPath, isPlatformAdminRole } from "../src/react-app/lib/session-routing";

describe("safeReturnPath", () => {
	it("keeps internal paths", () => {
		expect(safeReturnPath("/app/settings")).toBe("/app/settings");
		expect(safeReturnPath("/accept-invitation?invitationId=x")).toBe(
			"/accept-invitation?invitationId=x",
		);
	});

	it("rejects anything that could leave the app", () => {
		const hostile = [
			"https://evil.example",
			"http://evil.example",
			"//evil.example",
			"/\\evil.example",
			"javascript:alert(1)",
			"data:text/html,x",
			"app/dashboard",
			"/app\\..\\evil",
			"/app\u0000/evil",
			"/app\n/evil",
		];
		for (const value of hostile) {
			expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
		}
	});

	it("falls back for empty values", () => {
		expect(safeReturnPath(null)).toBe(DEFAULT_RETURN_PATH);
		expect(safeReturnPath(undefined)).toBe(DEFAULT_RETURN_PATH);
		expect(safeReturnPath("")).toBe(DEFAULT_RETURN_PATH);
	});
});

describe("authenticatedStartPath", () => {
	it("sends platform administrators to platform by default", () => {
		expect(isPlatformAdminRole("member, admin")).toBe(true);
		expect(authenticatedStartPath(null, "admin")).toBe("/platform");
		expect(authenticatedStartPath(undefined, "member")).toBe("/app/dashboard");
	});

	it("honors only explicit safe internal destinations", () => {
		expect(authenticatedStartPath("/platform/organizations/new", "admin")).toBe("/platform/organizations/new");
		expect(authenticatedStartPath("/app/settings", "member")).toBe("/app/settings");
		expect(authenticatedStartPath("https://evil.example", "admin")).toBe("/platform");
	});
});
