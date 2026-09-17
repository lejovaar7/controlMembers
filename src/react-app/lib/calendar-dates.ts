/** Date-only values must never pass through UTC serialization. */
export function dateValue(date: Date): string {
	return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDate(value: string): Date | undefined {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(0);
	date.setFullYear(year, month - 1, day);
	date.setHours(12, 0, 0, 0);
	return dateValue(date) === value ? date : undefined;
}

export function parseMonth(value: string): Date | undefined {
	return parseDate(`${value}-01`);
}
