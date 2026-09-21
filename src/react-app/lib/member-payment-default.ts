type PaymentContext = {
	charges: { id: string; branchId: string; dueDate: string; lifecycle: "open" | "void"; outstandingMinor: number }[];
	enrollments: { branchId: string; status: "active" | "paused" | "ended"; agreedAmountMinor: number; discountMinor: number }[];
};

/** Only suggest an existing unpaid charge; an advance must be intentional. */
export function memberPaymentDefault({ charges }: PaymentContext, branchId: string): number {
	const oldest = charges
		.filter((charge) => charge.branchId === branchId && charge.lifecycle === "open" && charge.outstandingMinor > 0)
		.sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id))[0];
	return oldest?.outstandingMinor ?? 0;
}
