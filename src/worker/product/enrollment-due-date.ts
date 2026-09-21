import { billingDateInMonth, nextBillingMonth } from "../../shared/billing-dates";
type EnrollmentSchedule = { id: string; status: string; startDate: string; endDate: string | null; dueDay: number; firstDueDate?: string | null; recurringDay?: number | null };
type ScheduledCharge = { enrollmentId: string; billingPeriod: string; dueDate: string; outstandingMinor: number };

export function enrollmentPeriodDueDate(item: EnrollmentSchedule, period: string): string | null {
	const date = item.firstDueDate && period === item.firstDueDate.slice(0, 7) ? item.firstDueDate : billingDateInMonth(period, item.recurringDay ?? item.dueDay);
	if (item.firstDueDate && (period < item.firstDueDate.slice(0, 7) || (item.endDate && date > item.endDate))) return null;
	return date;
}

/** Existing debt keeps its recorded date; projections share generation rules. */
export function enrollmentDueDate(item: EnrollmentSchedule, charges: ScheduledCharge[], today: string, memberActive: boolean): { date: string; kind: "pending" | "scheduled" } | null {
	const ownCharges = charges.filter((charge) => charge.enrollmentId === item.id);
	const pending = ownCharges.filter((charge) => charge.outstandingMinor > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
	if (pending) return { date: pending.dueDate, kind: "pending" };
	if (item.status !== "active" || !memberActive) return null;
	let period = item.firstDueDate?.slice(0, 7) ?? [today.slice(0, 7), item.startDate.slice(0, 7)].sort()[1]!;
	const generated = new Set(ownCharges.map((charge) => charge.billingPeriod));
	// Paid and voided periods are never generated again.
	while (generated.has(period)) {
		period = nextBillingMonth(period);
	}
	if (item.endDate && period > item.endDate.slice(0, 7)) return null;
	const date = enrollmentPeriodDueDate(item, period);
	return date ? { date, kind: "scheduled" } : null;
}
