import type { ImportRequest, ImportReview } from "../../shared/member-import";

export type CustomerMember = {
	id: string;
	displayName: string;
	primaryBranchId: string;
	status: "active" | "paused" | "inactive";
	documentType: string | null;
	documentNumber: string | null;
	birthDate: string | null;
	email: string | null;
	phoneE164: string | null;
	whatsappSameAsPhone: boolean;
	whatsappE164: string | null;
	notes: string | null;
	externalReference: string | null;
	outstandingMinor: number;
};

export type Enrollment = {
	id: string;
	planId: string;
	planName: string;
	branchId: string;
	status: "active" | "paused" | "ended";
	startDate: string;
	firstDueDate: string | null;
	recurringDay: number | null;
	endDate: string | null;
	agreedAmountMinor: number;
	currency: string;
	dueDay: number;
	discountMinor: number;
};

export type ReminderPreview = {
	memberName: string; companyName: string; branchName: string; currency: string;
	overdueMinor: number; creditMinor: number; amountMinor: number; overdueCount: number;
	oldestDueDate: string | null; blockedReason: "not_overdue" | "credit_covers_debt" | null;
	recipients: Array<{ id: string; name: string; phone: string; kind: "member" | "contact"; relationship: string }>;
};

export type Charge = {
	id: string;
	memberId: string;
	memberName: string;
	planName: string;
	branchId: string;
	branchName: string;
	billingPeriod: string;
	dueDate: string;
	subtotalMinor: number;
	discountMinor: number;
	adjustmentMinor: number;
	totalMinor: number;
	paidMinor: number;
	outstandingMinor: number;
	currency: string;
	lifecycle: "open" | "void";
	isOverdue?: boolean;
	paymentState: "paid" | "partial" | "overdue" | "pending" | "void";
};

export type PaymentMethod = { id: string; name: string | null; isActive: boolean; readOnly: boolean };

export type Payment = {
	applications?: Array<{ chargeId: string; planName: string; billingPeriod: string; dueDate: string; amountMinor: number }>;
	id: string;
	memberId: string;
	memberName: string;
	branchId: string;
	amountMinor: number;
	currency: string;
	paidAt: string;
	method: string;
	methodName: string | null;
	paymentMethodId: string | null;
	receiptNumber: string;
	status: "posted" | "reversed";
	allocatedMinor: number;
	creditMinor: number;
};

export type PaymentPreview = { allocations: Array<{ chargeId: string; amountMinor: number; dueDate: string; planName: string; billingPeriod: string; outstandingMinor: number }>; allocatedMinor: number; creditMinor: number };

export type MemberDetail = {
	member: CustomerMember;
	contacts: Array<{ id: string; relationshipId: string; displayName: string; email: string | null; phoneE164: string | null; relationship: string; isPrimary: boolean; isBillingContact: boolean; whatsappConsent: string }>;
	enrollments: Array<Enrollment & { paymentDue: { date: string; kind: "pending" | "scheduled" } | null }>;
	charges: Charge[];
	payments: Payment[];
	summary: { grossOutstandingMinor: number; creditMinor: number; netMinor: number };
};

export class ProductApiError extends Error {
	constructor(public code: string, public status: number) { super(code); }
}

async function requestJson<T>(path: string, organizationId: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	headers.set("Accept", "application/json");
	headers.set("X-Company-Context", organizationId);
	if (init?.body) headers.set("Content-Type", "application/json");
	const response = await fetch(path, { ...init, headers, credentials: "include" });
	if (!response.ok) {
		const body = await response.json().catch(() => ({})) as { error?: string };
		throw new ProductApiError(body.error ?? "REQUEST_FAILED", response.status);
	}
	return await response.json() as T;
}

const write = (method: "POST" | "PATCH", body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const controlMembersApi = {
	reminder: (organizationId: string, chargeId: string, signal?: AbortSignal) => requestJson<ReminderPreview>(`/api/charges/${encodeURIComponent(chargeId)}/reminder`, organizationId, { signal }),
	paymentMethods: (organizationId: string, mode: "active" | "inactive" | "history" = "active") => requestJson<{ methods: PaymentMethod[]; canManage: boolean }>(`/api/payment-methods?${mode}=1`, organizationId),
	createPaymentMethod: (organizationId: string, name: string) => requestJson<PaymentMethod>("/api/payment-methods", organizationId, write("POST", { name })),
	updatePaymentMethod: (organizationId: string, id: string, input: { name?: string; isActive?: boolean }) => requestJson<PaymentMethod>(`/api/payment-methods/${encodeURIComponent(id)}`, organizationId, write("PATCH", input)),
	members: (organizationId: string, search = "", status = "", offset = 0, signal?: AbortSignal) => requestJson<{ members: CustomerMember[]; nextOffset: number | null; currency: string | null }>(`/api/customer-members?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&offset=${offset}`, organizationId, { signal }),
	createMember: (organizationId: string, input: Record<string, unknown>) => requestJson<CustomerMember & { enrollmentId: string; firstChargeId: string | null }>("/api/customer-members", organizationId, write("POST", input)),
	member: (organizationId: string, id: string, signal?: AbortSignal) => requestJson<MemberDetail>(`/api/customer-members/${encodeURIComponent(id)}`, organizationId, { signal }),
	updateMember: (organizationId: string, id: string, input: Record<string, unknown>) => requestJson<CustomerMember>(`/api/customer-members/${encodeURIComponent(id)}`, organizationId, write("PATCH", input)),
	updateMemberStatus: (organizationId: string, id: string, status: string, reason: string) => requestJson(`/api/customer-members/${encodeURIComponent(id)}/status`, organizationId, write("PATCH", { status, reason })),
	addContact: (organizationId: string, id: string, input: Record<string, unknown>) => requestJson(`/api/customer-members/${encodeURIComponent(id)}/contacts`, organizationId, write("POST", input)),
	updateContact: (organizationId: string, id: string, relationshipId: string, input: Record<string, unknown>) => requestJson(`/api/customer-members/${encodeURIComponent(id)}/contacts/${encodeURIComponent(relationshipId)}`, organizationId, write("PATCH", input)),
	unlinkContact: (organizationId: string, id: string, relationshipId: string) => requestJson(`/api/customer-members/${encodeURIComponent(id)}/contacts/${encodeURIComponent(relationshipId)}`, organizationId, { method: "DELETE", body: "{}" }),
	addEnrollment: (organizationId: string, id: string, input: Record<string, unknown>) => requestJson<Enrollment & { firstChargeId: string | null }>(`/api/customer-members/${encodeURIComponent(id)}/enrollments`, organizationId, write("POST", input)),
	updateEnrollment: (organizationId: string, id: string, input: Record<string, unknown>) => requestJson<Enrollment>(`/api/enrollments/${encodeURIComponent(id)}`, organizationId, write("PATCH", input)),
	charges: (organizationId: string, period: string, state = "", offset = 0, filters: { branchId?: string; planId?: string; tag?: string; search?: string } = {}, signal?: AbortSignal) => { const query = new URLSearchParams({ period, state, offset: String(offset), ...filters }); return requestJson<{ charges: Charge[]; nextOffset: number | null }>(`/api/charges?${query}`, organizationId, { signal }); },
	generateCharges: (organizationId: string, period: string) => requestJson<{ created: number; alreadyExisting: number }>("/api/charges/generate", organizationId, write("POST", { period })),
	previewChargeGeneration: (organizationId: string, period: string) => requestJson<{ eligible: number; willCreate: number; alreadyExisting: number; skipped: number }>("/api/charges/generate/preview", organizationId, write("POST", { period })),
	adjustCharge: (organizationId: string, id: string, adjustmentMinor: number, reason: string) => requestJson(`/api/charges/${encodeURIComponent(id)}/adjust`, organizationId, write("PATCH", { adjustmentMinor, reason })),
	voidCharge: (organizationId: string, id: string, reason: string) => requestJson(`/api/charges/${encodeURIComponent(id)}/void`, organizationId, write("PATCH", { reason })),
	payments: (organizationId: string, offset = 0, filters: { branchId?: string; method?: string; status?: string; search?: string; dateFrom?: string; dateTo?: string } = {}, signal?: AbortSignal) => { const query = new URLSearchParams({ offset: String(offset), ...filters }); return requestJson<{ payments: Payment[]; nextOffset: number | null }>(`/api/payments?${query}`, organizationId, { signal }); },
	createPayment: (organizationId: string, input: Record<string, unknown>) => requestJson<Payment>("/api/payments", organizationId, write("POST", input)),
	paymentPreview: (organizationId: string, memberId: string, amountMinor: number, chargeId?: string, signal?: AbortSignal) => requestJson<PaymentPreview>(`/api/customer-members/${encodeURIComponent(memberId)}/payment-preview?${new URLSearchParams({ amountMinor: String(amountMinor), ...(chargeId ? { chargeId } : {}) })}`, organizationId, { signal }),
	reversePayment: (organizationId: string, id: string, reason: string) => requestJson<Payment>(`/api/payments/${encodeURIComponent(id)}/reverse`, organizationId, write("PATCH", { reason })),
	dashboard: (organizationId: string, period: string) => requestJson<{ period: string; currency: string; expectedMinor: number; collectedMinor: number; allocatedMinor: number; outstandingMinor: number; overdueMembers: number; upcomingDueCount: number; upcomingDueMinor: number; collectionRate: number | null; scope: string; asOf: string }>(`/api/dashboard?period=${encodeURIComponent(period)}`, organizationId),
	balances: (organizationId: string) => requestJson<{ balances: Array<{ id: string; displayName: string; branchName: string; status: string; outstandingMinor: number; creditMinor: number; netMinor: number }>; currency: string }>("/api/reports/member-balances", organizationId),
	financialReports: (organizationId: string, period: string) => requestJson<{ period: string; currency: string; asOf: string; aging: { current: number; days1To30: number; days31To60: number; days61To90: number; days90Plus: number }; plans: Array<{ id: string; name: string; expectedMinor: number; allocatedMinor: number; outstandingMinor: number }>; branches: Array<{ id: string; name: string; expectedMinor: number; allocatedMinor: number; outstandingMinor: number }>; scope: string }>(`/api/reports/financial-summary?period=${encodeURIComponent(period)}`, organizationId),
	previewImport: (organizationId: string, csv: string) => requestJson<{ rows: Array<{ row: number; memberName: string; errors: string[]; warnings: string[] }>; validCount: number; invalidCount: number; warningCount: number }>("/api/imports/members/preview", organizationId, write("POST", { csv })),
	reviewImport: (organizationId: string, payload: ImportRequest) => requestJson<ImportReview>("/api/imports/members/preview", organizationId, write("POST", payload)),
	saveImport: (organizationId: string, payload: ImportRequest, reviewToken: string, idempotencyKey: string) => requestJson<{ created: number; skipped: number; failed: number }>("/api/imports/members/confirm", organizationId, write("POST", { ...payload, reviewToken, idempotencyKey })),
	confirmImport: (organizationId: string, csv: string, idempotencyKey: string) => requestJson<{ created: number; skipped: number; failed: number }>("/api/imports/members/confirm", organizationId, write("POST", { csv, idempotencyKey })),
};

export function currentPeriod() {
	return new Date().toISOString().slice(0, 7);
}
