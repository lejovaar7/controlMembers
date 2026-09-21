export type CollectionView = "fees" | "payments";
const feeKeys = ["period", "state", "planId", "tag", "search"];
const paymentKeys = ["search", "method", "status", "dateFrom", "dateTo"];

/** Preserve all records for old links without an explicit state. */
export function legacyCollectionUrl(view: CollectionView, search: string) {
	const previous = new URLSearchParams(search); const query = new URLSearchParams();
	for (const key of view === "fees" ? feeKeys : paymentKeys) if (previous.has(key)) query.set(key, previous.get(key)!);
	if (view === "fees" && !query.get("period")) query.set("period", new Date().toISOString().slice(0, 7));
	const stateKey = view === "fees" ? "state" : "status";
	if (!query.has(stateKey) || !query.get(stateKey)) query.set(stateKey, "all");
	return `/app/collections/${view}?${query}`;
}

export function paymentMonthQuery(period: string) {
	const [year, month] = period.split("-").map(Number);
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return `status=posted&dateFrom=${period}-01&dateTo=${period}-${lastDay}`;
}
