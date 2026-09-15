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

export const program = sqliteTable("program", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	description: text("description"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	uniqueIndex("program_active_name_uidx").on(table.organizationId, table.normalizedName).where(sql`${table.isActive} = 1`),
	index("program_organization_active_idx").on(table.organizationId, table.isActive),
]);

export const programBranch = sqliteTable("program_branch", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	programId: text("program_id").notNull().references(() => program.id, { onDelete: "cascade" }),
	branchId: text("branch_id").notNull().references(() => team.id, { onDelete: "cascade" }),
	createdAt: timestampMs(),
}, (table) => [
	uniqueIndex("program_branch_program_branch_uidx").on(table.programId, table.branchId),
	index("program_branch_organization_branch_idx").on(table.organizationId, table.branchId),
]);

export const billingPlan = sqliteTable("billing_plan", {
	id: text("id").primaryKey(),
	organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	programId: text("program_id").references(() => program.id, { onDelete: "restrict" }),
	name: text("name").notNull(),
	normalizedName: text("normalized_name").notNull(),
	amountMinor: integer("amount_minor").notNull(),
	currency: text("currency").notNull(),
	frequency: text("frequency").notNull().default("monthly"),
	defaultDueDay: integer("default_due_day").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
	createdAt: timestampMs(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
}, (table) => [
	uniqueIndex("billing_plan_active_name_uidx").on(table.organizationId, table.normalizedName).where(sql`${table.isActive} = 1`),
	index("billing_plan_organization_active_idx").on(table.organizationId, table.isActive),
	check("billing_plan_positive_amount", sql`${table.amountMinor} > 0`),
	check("billing_plan_monthly_frequency", sql`${table.frequency} = 'monthly'`),
	check("billing_plan_due_day_range", sql`${table.defaultDueDay} between 1 and 28`),
]);
