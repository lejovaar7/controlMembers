/** Calendar-only arithmetic shared by enrollment forms and billing. */
export function nextBillingMonth(period: string): string {
	const [year, month] = period.split("-").map(Number);
	return month === 12 ? `${String(year! + 1).padStart(4, "0")}-01` : `${String(year).padStart(4, "0")}-${String(month! + 1).padStart(2, "0")}`;
}

export function billingDateInMonth(period: string, day: number): string {
	const [year, month] = period.split("-").map(Number);
	const end = new Date(0);
	end.setUTCFullYear(year!, month!, 0);
	return `${period}-${String(Math.min(day, end.getUTCDate())).padStart(2, "0")}`;
}

export function defaultFirstDueDate(startDate: string): string {
	return startDate;
}
