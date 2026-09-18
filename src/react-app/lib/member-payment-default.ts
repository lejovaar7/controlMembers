type PaymentContext = {
	charges: { id: string; branchId: string; dueDate: string; lifecycle: "open" | "void"; outstandingMinor: number }[];
	enrollments: { branchId: string; status: "active" | "paused" | "ended"; agreedAmountMinor: number; discountMinor: number }[];
};

/** Suggest one pending monthly charge, or the member's agreed active fees. */
export function memberPaymentDefault({ charges, enrollments }: PaymentContext, branchId: string): number {
	const oldest = charges
		.filter((charge) => charge.branchId === branchId && charge.lifecycle === "open" && charge.outstandingMinor > 0)
		.sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id))[0];
	if (oldest) return oldest.outstandingMinor;
	return enrollments
		.filter((enrollment) => enrollment.branchId === branchId && enrollment.status === "active")
		.reduce((amount, enrollment) => amount + Math.max(0, enrollment.agreedAmountMinor - enrollment.discountMinor), 0);
}
