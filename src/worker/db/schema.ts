import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { organization, team, user } from "./auth-schema";

/**
 * Technical table used only to verify the
 * schema -> migration -> D1 -> query path.
 */
export const systemCheck = sqliteTable("system_check", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	value: text("value").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

const timestampMs = () => integer("created_at", { mode: "timestamp_ms" })
	.notNull()
	.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`);

export const plan = sqliteTable("plan", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	description: text("description"),
	amountMinor: integer("amount_minor").notNull(),
	currency: text("currency").notNull(),
	frequency: text("frequency").notNull().default("monthly"),
	defaultDueDay: integer("default_due_day").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	uniqueIndex("plan_active_name_uidx").on(table.organizationId, table.normalizedName).where(sql`${table.isActive} = 1`),
	index("plan_organization_active_idx").on(table.organizationId, table.isActive),
	check("plan_positive_amount", sql`${table.amountMinor} > 0`),
	check("plan_monthly_frequency", sql`${table.frequency} = 'monthly'`),
	check("plan_due_day_range", sql`${table.defaultDueDay} between 1 and 28`),
]);

export const planBranch = sqliteTable("plan_branch", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	planId: text("plan_id").notNull().references(() => plan.id, { onDelete: "cascade" }),
	branchId: text("branch_id").notNull().references(() => team.id, { onDelete: "cascade" }),
	createdAt: timestampMs(),
}, (table) => [
	uniqueIndex("plan_branch_plan_branch_uidx").on(table.planId, table.branchId),
	index("plan_branch_organization_branch_idx").on(table.organizationId, table.branchId),
]);

export const tag = sqliteTable("tag", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	uniqueIndex("tag_organization_name_uidx").on(table.organizationId, table.normalizedName),
	index("tag_organization_name_idx").on(table.organizationId, table.name),
]);

export const planTag = sqliteTable("plan_tag", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	planId: text("plan_id").notNull().references(() => plan.id, { onDelete: "cascade" }),
	tagId: text("tag_id").notNull().references(() => tag.id, { onDelete: "cascade" }),
	createdAt: timestampMs(),
}, (table) => [
	uniqueIndex("plan_tag_plan_tag_uidx").on(table.planId, table.tagId),
	index("plan_tag_organization_tag_idx").on(table.organizationId, table.tagId),
]);

export const customerMember = sqliteTable("customer_member", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	primaryBranchId: text("primary_branch_id").notNull().references(() => team.id, { onDelete: "restrict" }),
	displayName: text("display_name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	status: text("status").notNull().default("active"),
	documentType: text("document_type"),
	documentNumber: text("document_number"),
	normalizedDocument: text("normalized_document"),
	birthDate: text("birth_date"),
	email: text("email"),
	phoneE164: text("phone_e164"),
	notes: text("notes"),
	externalReference: text("external_reference"),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	index("customer_member_org_branch_status_idx").on(table.organizationId, table.primaryBranchId, table.status),
	index("customer_member_org_name_idx").on(table.organizationId, table.normalizedName),
	uniqueIndex("customer_member_org_document_uidx").on(table.organizationId, table.normalizedDocument).where(sql`${table.normalizedDocument} is not null`),
	uniqueIndex("customer_member_org_external_ref_uidx").on(table.organizationId, table.externalReference).where(sql`${table.externalReference} is not null`),
	check("customer_member_status_check", sql`${table.status} in ('active', 'paused', 'inactive')`),
]);

export const contact = sqliteTable("contact", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	displayName: text("display_name").notNull(),
	email: text("email"),
	phoneE164: text("phone_e164"),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [index("contact_org_name_idx").on(table.organizationId, table.displayName)]);

export const memberContact = sqliteTable("member_contact", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	memberId: text("member_id").notNull().references(() => customerMember.id, { onDelete: "cascade" }),
	contactId: text("contact_id").notNull().references(() => contact.id, { onDelete: "cascade" }),
	relationship: text("relationship").notNull().default("other"),
	isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
	isBillingContact: integer("is_billing_contact", { mode: "boolean" }).notNull().default(false),
	whatsappConsent: text("whatsapp_consent").notNull().default("none"),
	consentCapturedAt: integer("consent_captured_at", { mode: "timestamp_ms" }),
	consentSource: text("consent_source"),
	consentWithdrawnAt: integer("consent_withdrawn_at", { mode: "timestamp_ms" }),
	createdAt: timestampMs(),
}, (table) => [
	uniqueIndex("member_contact_member_contact_uidx").on(table.memberId, table.contactId),
	uniqueIndex("member_contact_primary_uidx").on(table.memberId).where(sql`${table.isPrimary} = 1`),
	uniqueIndex("member_contact_billing_uidx").on(table.memberId).where(sql`${table.isBillingContact} = 1`),
	index("member_contact_org_contact_idx").on(table.organizationId, table.contactId),
	check("member_contact_consent_check", sql`${table.whatsappConsent} in ('none', 'granted')`),
]);

export const enrollment = sqliteTable("enrollment", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	memberId: text("member_id").notNull().references(() => customerMember.id, { onDelete: "restrict" }),
	planId: text("plan_id").notNull().references(() => plan.id, { onDelete: "restrict" }),
	branchId: text("branch_id").notNull().references(() => team.id, { onDelete: "restrict" }),
	startDate: text("start_date").notNull(),
	// Null dates identify legacy calendar-month enrollments; their terms stay intact.
	firstDueDate: text("first_due_date"),
	// Preserves the requested day (including 29-31) when a short month clamps it.
	recurringDay: integer("recurring_day"),
	endDate: text("end_date"),
	status: text("status").notNull().default("active"),
	agreedAmountMinor: integer("agreed_amount_minor").notNull(),
	currency: text("currency").notNull(),
	dueDay: integer("due_day").notNull(),
	discountMinor: integer("discount_minor").notNull().default(0),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	index("enrollment_org_member_status_idx").on(table.organizationId, table.memberId, table.status),
	index("enrollment_org_branch_status_idx").on(table.organizationId, table.branchId, table.status),
	uniqueIndex("enrollment_active_member_plan_branch_uidx").on(table.organizationId, table.memberId, table.planId, table.branchId).where(sql`${table.status} != 'ended'`),
	check("enrollment_status_check", sql`${table.status} in ('active', 'paused', 'ended')`),
	check("enrollment_amount_check", sql`${table.agreedAmountMinor} > 0`),
	check("enrollment_due_day_check", sql`${table.dueDay} between 1 and 28`),
	check("enrollment_discount_check", sql`${table.discountMinor} >= 0 and ${table.discountMinor} <= ${table.agreedAmountMinor}`),
]);

export const charge = sqliteTable("charge", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	enrollmentId: text("enrollment_id").notNull().references(() => enrollment.id, { onDelete: "restrict" }),
	memberId: text("member_id").notNull().references(() => customerMember.id, { onDelete: "restrict" }),
	planId: text("plan_id").notNull().references(() => plan.id, { onDelete: "restrict" }),
	branchId: text("branch_id").notNull().references(() => team.id, { onDelete: "restrict" }),
	billingPeriod: text("billing_period").notNull(),
	dueDate: text("due_date").notNull(),
	subtotalMinor: integer("subtotal_minor").notNull(),
	discountMinor: integer("discount_minor").notNull().default(0),
	adjustmentMinor: integer("adjustment_minor").notNull().default(0),
	totalMinor: integer("total_minor").notNull(),
	currency: text("currency").notNull(),
	memberNameSnapshot: text("member_name_snapshot").notNull(),
	planNameSnapshot: text("plan_name_snapshot").notNull(),
	branchNameSnapshot: text("branch_name_snapshot").notNull(),
	status: text("status").notNull().default("open"),
	voidReason: text("void_reason"),
	voidedByUserId: text("voided_by_user_id").references(() => user.id, { onDelete: "restrict" }),
	voidedAt: integer("voided_at", { mode: "timestamp_ms" }),
	generationBatchId: text("generation_batch_id"),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	uniqueIndex("charge_org_enrollment_period_uidx").on(table.organizationId, table.enrollmentId, table.billingPeriod),
	index("charge_org_period_branch_idx").on(table.organizationId, table.billingPeriod, table.branchId),
	index("charge_org_member_due_idx").on(table.organizationId, table.memberId, table.dueDate),
	check("charge_status_check", sql`${table.status} in ('open', 'void')`),
	check("charge_total_check", sql`${table.totalMinor} >= 0 and ${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor} + ${table.adjustmentMinor}`),
]);

export const paymentMethod = sqliteTable("payment_method", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: timestampMs(),
}, (table) => [uniqueIndex("payment_method_org_name_uidx").on(table.organizationId, table.normalizedName)]);

export const payment = sqliteTable("payment", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	memberId: text("member_id").notNull().references(() => customerMember.id, { onDelete: "restrict" }),
	branchId: text("branch_id").notNull().references(() => team.id, { onDelete: "restrict" }),
	amountMinor: integer("amount_minor").notNull(),
	currency: text("currency").notNull(),
	paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
	method: text("method").notNull(),
	paymentMethodId: text("payment_method_id").references(() => paymentMethod.id, { onDelete: "restrict" }),
	methodName: text("method_name"),
	externalReference: text("external_reference"),
	note: text("note"),
	receiptNumber: text("receipt_number").notNull(),
	status: text("status").notNull().default("posted"),
	idempotencyKey: text("idempotency_key").notNull(),
	payloadFingerprint: text("payload_fingerprint").notNull(),
	recordedByUserId: text("recorded_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	recordedAt: timestampMs(),
	reversedByUserId: text("reversed_by_user_id").references(() => user.id, { onDelete: "restrict" }),
	reversedAt: integer("reversed_at", { mode: "timestamp_ms" }),
	reversalReason: text("reversal_reason"),
}, (table) => [
	uniqueIndex("payment_org_receipt_uidx").on(table.organizationId, table.receiptNumber),
	uniqueIndex("payment_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
	index("payment_org_paid_branch_idx").on(table.organizationId, table.paidAt, table.branchId),
	index("payment_org_member_idx").on(table.organizationId, table.memberId),
	check("payment_amount_check", sql`${table.amountMinor} > 0`),
	check("payment_method_check", sql`${table.method} in ('cash', 'bank_transfer', 'card', 'other')`),
	check("payment_status_check", sql`${table.status} in ('posted', 'reversed')`),
]);

export const allocation = sqliteTable("allocation", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	paymentId: text("payment_id").notNull().references(() => payment.id, { onDelete: "restrict" }),
	chargeId: text("charge_id").notNull().references(() => charge.id, { onDelete: "restrict" }),
	amountMinor: integer("amount_minor").notNull(),
	createdAt: timestampMs(),
}, (table) => [
	uniqueIndex("allocation_payment_charge_uidx").on(table.paymentId, table.chargeId),
	index("allocation_org_charge_idx").on(table.organizationId, table.chargeId),
	check("allocation_amount_check", sql`${table.amountMinor} > 0`),
]);

export const auditEvent = sqliteTable("audit_event", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	eventType: text("event_type").notNull(),
	actorUserId: text("actor_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	subjectType: text("subject_type").notNull(),
	subjectId: text("subject_id").notNull(),
	branchId: text("branch_id").references(() => team.id, { onDelete: "restrict" }),
	detailsJson: text("details_json").notNull().default("{}"),
	version: integer("version").notNull().default(1),
	createdAt: timestampMs(),
}, (table) => [
	index("audit_event_org_subject_idx").on(table.organizationId, table.subjectType, table.subjectId),
	index("audit_event_org_created_idx").on(table.organizationId, table.createdAt),
]);

export const importBatch = sqliteTable("import_batch", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	idempotencyKey: text("idempotency_key").notNull(),
	payloadFingerprint: text("payload_fingerprint").notNull(),
	createdCount: integer("created_count").notNull().default(0),
	skippedCount: integer("skipped_count").notNull().default(0),
	failedCount: integer("failed_count").notNull().default(0),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
}, (table) => [uniqueIndex("import_batch_org_key_uidx").on(table.organizationId, table.idempotencyKey)]);
