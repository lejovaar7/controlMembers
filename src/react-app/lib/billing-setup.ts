export type BillingSettings = {
	organizationId: string;
	currency: string | null;
	timezone: string | null;
	canEdit: boolean;
};

export type Tag = {
	id: string;
	name: string;
};

export type Plan = {
	id: string;
	name: string;
	description: string | null;
	amountMinor: number;
	currency: string;
	frequency: "monthly";
	defaultDueDay: number;
	isActive: boolean;
	branchIds: string[];
	tags: Tag[];
};

export type PlanInput = {
	name: string;
	description?: string;
	amountMinor: number;
	defaultDueDay: number;
	branchIds: string[];
	tagNames: string[];
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
	plans: (organizationId: string) => requestJson<{ plans: Plan[]; tags: Tag[] }>("/api/plans", organizationId),
	createPlan: (organizationId: string, input: PlanInput) => requestJson<Plan>("/api/plans", organizationId, { method: "POST", body: JSON.stringify(input) }),
	updatePlan: (organizationId: string, id: string, input: Partial<PlanInput> & { isActive?: boolean }) => requestJson<Plan>(`/api/plans/${encodeURIComponent(id)}`, organizationId, { method: "PATCH", body: JSON.stringify(input) }),
};
