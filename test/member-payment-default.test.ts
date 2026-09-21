import { describe, expect, it } from "vitest";
import { memberPaymentDefault } from "../src/react-app/lib/member-payment-default";

describe("member payment suggestion", () => {
	it("suggests only the remaining amount of the oldest open charge in this branch", () => {
		const charges = [
			{ id: "newer", branchId: "main", dueDate: "2026-09-05", lifecycle: "open" as const, outstandingMinor: 15000000 },
			{ id: "partial", branchId: "main", dueDate: "2026-08-05", lifecycle: "open" as const, outstandingMinor: 5000050 },
			{ id: "void", branchId: "main", dueDate: "2026-01-05", lifecycle: "void" as const, outstandingMinor: 15000000 },
			{ id: "paid", branchId: "main", dueDate: "2026-02-05", lifecycle: "open" as const, outstandingMinor: 0 },
			{ id: "other", branchId: "other", dueDate: "2026-01-05", lifecycle: "open" as const, outstandingMinor: 10000000 },
		];
		expect(memberPaymentDefault({ charges, enrollments: [] }, "main")).toBe(5000050);
		expect(charges[0].id).toBe("newer");
	});

	it("does not suggest charging a plan before its charge exists", () => {
		expect(memberPaymentDefault({ charges: [], enrollments: [{ branchId: "main", status: "active", agreedAmountMinor: 15000000, discountMinor: 2000000 }] }, "main")).toBe(0);
	});

	it("does not manufacture new debt from active enrollments", () => {
		const enrollments = [
			{ branchId: "main", status: "active" as const, agreedAmountMinor: 10000000, discountMinor: 0 },
			{ branchId: "main", status: "active" as const, agreedAmountMinor: 5000000, discountMinor: 500000 },
			{ branchId: "main", status: "paused" as const, agreedAmountMinor: 10000000, discountMinor: 0 },
			{ branchId: "main", status: "ended" as const, agreedAmountMinor: 10000000, discountMinor: 0 },
			{ branchId: "other", status: "active" as const, agreedAmountMinor: 10000000, discountMinor: 0 },
		];
		expect(memberPaymentDefault({ charges: [], enrollments }, "main")).toBe(0);
	});

	it("leaves the amount unset when no charge or active monthly fee is available", () => {
		expect(memberPaymentDefault({ charges: [], enrollments: [] }, "main")).toBe(0);
	});
});
