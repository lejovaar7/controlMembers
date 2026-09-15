export type BillingSettings = {
	organizationId: string;
	currency: string | null;
	timezone: string | null;
	canEdit: boolean;
};

export type Program = {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
	branchIds: string[];
};

export type BillingPlan = {
	id: string;
	name: string;
	programId: string | null;
	amountMinor: number;
	currency: string;
	frequency: "monthly";
	defaultDueDay: number;
	isActive: boolean;
};

async function requestJson<T>(path: string, organizationId: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("Accept", "application/json");
	headers.set("X-Company-Context", organizationId);
	if (init?.body) headers.set("Content-Type", "application/json");
	const response = await fetch(path, { ...init, headers, credentials: "include" });
	if (!response.ok) throw new Error("REQUEST_FAILED");
	return await response.json() as T;
}

export const billingSetupApi = {
	settings: (organizationId: string) => requestJson<BillingSettings>("/api/product/settings", organizationId),
	saveSettings: (organizationId: string, currency: string, timezone: string) => requestJson<BillingSettings>("/api/product/settings", organizationId, { method: "PATCH", body: JSON.stringify({ currency, timezone }) }),
	programs: (organizationId: string) => requestJson<{ programs: Program[] }>("/api/programs", organizationId),
	createProgram: (organizationId: string, input: { name: string; description?: string; branchIds: string[] }) => requestJson<Program>("/api/programs", organizationId, { method: "POST", body: JSON.stringify(input) }),
	plans: (organizationId: string) => requestJson<{ plans: BillingPlan[] }>("/api/billing-plans", organizationId),
	createPlan: (organizationId: string, input: { name: string; programId: string | null; amountMinor: number; defaultDueDay: number }) => requestJson<BillingPlan>("/api/billing-plans", organizationId, { method: "POST", body: JSON.stringify(input) }),
};
