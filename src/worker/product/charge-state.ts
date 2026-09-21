/** Shared by the member detail and collections list. */
export function chargeState(item: { lifecycle: string; totalMinor: number; paidMinor: number; dueDate: string }, today: string) {
	if (item.lifecycle === "void") return "void";
	if (item.paidMinor >= item.totalMinor) return "paid";
	if (item.paidMinor > 0) return "partial";
	return item.dueDate < today ? "overdue" : "pending";
}
