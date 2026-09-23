export const plans = [
	{ id: "base", name: "Base", price: 99900 },
	{ id: "plus", name: "Plus", price: 149900 },
	{ id: "pro", name: "Pro", price: 199900 },
];

export function calculateCommission(price, rate, clients) {
	if (!Number.isSafeInteger(price) || price < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isSafeInteger(clients) || clients < 0 || clients > 10000) {
		throw new RangeError("Invalid commission inputs");
	}
	const perClient = Math.round(price * rate / 100);
	const monthly = perClient * clients;
	return { perClient, monthly, annual: monthly * 12, revenue: price * clients };
}
