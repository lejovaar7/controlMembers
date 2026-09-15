import { AuthError } from "../auth/session";
import { getBranch } from "../tenant/branch";
import type { TenantContext } from "../tenant";
import { RequestError } from "../http";

export const now = () => new Date();
export const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export function readString(value: unknown, max: number, required = false) {
	if (value === undefined || value === null || value === "") {
		if (required) throw new RequestError(400, "INVALID_INPUT");
		return null;
	}
	if (typeof value !== "string") throw new RequestError(400, "INVALID_INPUT");
	const result = value.trim().replace(/\s+/g, " ");
	if ((!result && required) || result.length > max) throw new RequestError(400, "INVALID_INPUT");
	return result || null;
}

export function readEmail(value: unknown) {
	const email = readString(value, 254);
	if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RequestError(400, "INVALID_INPUT");
	return email?.toLocaleLowerCase("en") ?? null;
}

export function readPhone(value: unknown) {
	const phone = readString(value, 20);
	if (!phone) return null;
	const normalized = phone.replace(/[\s()-]/g, "");
	if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new RequestError(400, "INVALID_INPUT");
	return normalized;
}

export function readDate(value: unknown, required = false) {
	const date = readString(value, 10, required);
	if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RequestError(400, "INVALID_INPUT");
	if (date) {
		const parsed = new Date(`${date}T00:00:00Z`);
		if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new RequestError(400, "INVALID_INPUT");
	}
	return date;
}

export function readPeriod(value: unknown) {
	const period = readString(value, 7, true)!;
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new RequestError(400, "INVALID_PERIOD");
	return period;
}

export function localDate(timezone: string | null, at = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit",
	}).formatToParts(at);
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
	return `${get("year")}-${get("month")}-${get("day")}`;
}

export function requireConfiguredBilling(tenant: TenantContext) {
	if (!tenant.currency || !tenant.timezone) throw new RequestError(409, "BILLING_SETTINGS_REQUIRED");
}

export function canReadReports(tenant: TenantContext) {
	return tenant.organizationRole === "owner" || tenant.organizationRole === "admin" || tenant.canViewReports;
}

export function requireReports(tenant: TenantContext) {
	if (!canReadReports(tenant)) throw new AuthError(403, "PERMISSION_DENIED");
}

export function requireExport(tenant: TenantContext) {
	if (!(tenant.organizationRole === "owner" || tenant.canExportFinancialData)) throw new AuthError(403, "PERMISSION_DENIED");
}

export function requireAdjustCharges(tenant: TenantContext) {
	if (!(tenant.organizationRole === "owner" || tenant.canAdjustCharges)) throw new AuthError(403, "PERMISSION_DENIED");
}

export function requireReversePayments(tenant: TenantContext) {
	if (!(tenant.organizationRole === "owner" || tenant.canReversePayments)) throw new AuthError(403, "PERMISSION_DENIED");
}

export function requireGenerateCharges(tenant: TenantContext) {
	if (!(tenant.organizationRole === "owner" || tenant.organizationRole === "admin")) throw new AuthError(403, "PERMISSION_DENIED");
}

export async function requireAccessibleBranch(env: Env, tenant: TenantContext, branchId: unknown) {
	if (typeof branchId !== "string" || !branchId.trim()) throw new RequestError(400, "INVALID_INPUT");
	const branch = await getBranch(env, tenant, branchId.trim());
	if (!branch) throw new AuthError(404, "RESOURCE_NOT_FOUND");
	return branch;
}

export function details(value: unknown) {
	return JSON.stringify(value);
}

export function csvCell(value: unknown) {
	let result = String(value ?? "");
	if (/^[=+\-@]/.test(result)) result = `'${result}`;
	return `"${result.replace(/"/g, '""')}"`;
}
