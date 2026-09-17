import { describe, expect, it } from "vitest";
import { dateValue, parseDate, parseMonth } from "../src/react-app/lib/calendar-dates";

describe("calendar API values", () => {
	it("round-trips leap days and early years without UTC conversion", () => {
		for (const value of ["2024-02-29", "2026-09-17", "0099-01-01", "1900-12-31"]) {
			const date = parseDate(value)!;
			expect(dateValue(date)).toBe(value);
			expect(date.getHours()).toBe(12);
		}
		expect(dateValue(new Date(2026, 8, 17, 0, 1))).toBe("2026-09-17");
		expect(dateValue(new Date(2026, 8, 17, 23, 59))).toBe("2026-09-17");
	});
	it("rejects invalid or normalized dates instead of moving the chosen day", () => {
		for (const value of ["", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-09-00", "26-09-17", "2026-9-17", "2026-09-17T00:00:00Z"]) {
			expect(parseDate(value)).toBeUndefined();
		}
	});
	it("keeps billing months in the existing YYYY-MM API format", () => {
		expect(dateValue(parseMonth("2026-09")!).slice(0, 7)).toBe("2026-09");
		expect(parseMonth("2026-13")).toBeUndefined();
		expect(parseMonth("")).toBeUndefined();
	});
});
