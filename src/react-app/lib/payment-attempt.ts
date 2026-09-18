import type { PaymentPreview } from "@/lib/controlmembers";

export type PaymentAttempt = {
	input: { memberId: string; branchId: string; amountMinor: number; method: string; paidAt: string; allocations: Array<{ chargeId: string; amountMinor: number }>; idempotencyKey: string };
	preview: PaymentPreview;
	methodName: string;
};

// Keep uncertain requests across dialog dismissal/navigation in this app session.
// Never reuse an attempt across organizations, branches or members.
export const pendingPaymentAttempts = new Map<string, PaymentAttempt>();
export const paymentAttemptScope = (organizationId: string, branchId: string, memberId: string) => JSON.stringify([organizationId, branchId, memberId]);
