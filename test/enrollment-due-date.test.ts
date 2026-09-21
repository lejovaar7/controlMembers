import { describe, expect, it } from "vitest";
import { enrollmentDueDate } from "../src/worker/product/enrollment-due-date";
import { localDate } from "../src/worker/product/domain";

const enrollment = { id: "enrollment", status: "active", startDate: "2026-10-01", endDate: null, dueDay: 1 };
const fee = { enrollmentId: enrollment.id, billingPeriod: "2026-10", dueDate: "2026-10-01", outstandingMinor: 0 };

describe("enrollment payment dates", () => {
	it("includes the start month instead of presenting an ambiguous day number", () => {
		expect(enrollmentDueDate(enrollment, [], "2026-09-21", true)).toEqual({ date: "2026-10-01", kind: "scheduled" });
	});
	it("keeps the earliest unpaid snapshot even after future terms change", () => {
		const charges = [{ ...fee, outstandingMinor: 100 }, { ...fee, billingPeriod: "2026-11", dueDate: "2026-11-12", outstandingMinor: 8000 }];
		expect(enrollmentDueDate({ ...enrollment, dueDay: 12 }, charges, "2026-11-20", true)).toEqual({ date: "2026-10-01", kind: "pending" });
	});
	it("skips completed periods and crosses the year boundary", () => {
		const charges = [fee, { ...fee, billingPeriod: "2026-11" }, { ...fee, billingPeriod: "2026-12" }];
		expect(enrollmentDueDate(enrollment, charges, "2026-10-21", true)).toEqual({ date: "2027-01-01", kind: "scheduled" });
	});
	it("does not mix enrollments or project beyond an ended or paused schedule", () => {
		const foreign = [{ ...fee, enrollmentId: "other", dueDate: "2020-01-01", outstandingMinor: 100 }];
		expect(enrollmentDueDate(enrollment, foreign, "2026-10-01", true)?.date).toBe("2026-10-01");
		for (const status of ["paused", "ended"]) {
			expect(enrollmentDueDate({ ...enrollment, status }, [], "2026-10-01", true)).toBeNull();
			expect(enrollmentDueDate({ ...enrollment, status }, [{ ...fee, outstandingMinor: 100 }], "2026-10-01", true)?.kind).toBe("pending");
		}
		expect(enrollmentDueDate(enrollment, [], "2026-10-01", false)).toBeNull();
		expect(enrollmentDueDate({ ...enrollment, endDate: "2026-10-31" }, [fee], "2026-10-01", true)).toBeNull();
	});
	it("uses the company month and preserves the calendar-month billing rule", () => {
		const today = localDate("America/Bogota", new Date("2026-11-01T02:00:00Z"));
		expect(enrollmentDueDate(enrollment, [], today, true)?.date).toBe("2026-10-01");
		expect(enrollmentDueDate({ ...enrollment, startDate: "2026-10-15" }, [], today, true)?.date).toBe("2026-10-01");
	});
});
