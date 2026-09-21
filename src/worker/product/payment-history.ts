import { and, asc, eq, inArray } from "drizzle-orm";
import { getTenantDb } from "../db";
import { allocation, charge } from "../db/schema";

/** Call only with payment IDs from the authorized member/branch query. */
export async function paymentApplications(env: Env, organizationId: string, paymentIds: string[]) {
	if (!paymentIds.length) return [];
	return getTenantDb(env, organizationId).select({ paymentId: allocation.paymentId, chargeId: charge.id,
		planName: charge.planNameSnapshot, billingPeriod: charge.billingPeriod, dueDate: charge.dueDate, amountMinor: allocation.amountMinor })
		.from(allocation).innerJoin(charge, and(eq(charge.id, allocation.chargeId), eq(charge.organizationId, organizationId)))
		.where(and(eq(allocation.organizationId, organizationId), inArray(allocation.paymentId, paymentIds)))
		.orderBy(asc(charge.dueDate), asc(charge.id));
}
