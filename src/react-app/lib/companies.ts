export type Company = { id: string; name: string };

/** Multiple memberships never imply an arbitrary first-company selection. */
export function companySelection(companies: Company[], activeId: string | null) {
	if (activeId && companies.some((company) => company.id === activeId)) return { kind: "active" as const, id: activeId };
	if (companies.length === 0) return { kind: "none" as const };
	if (companies.length === 1) return { kind: "activate" as const, id: companies[0]!.id };
	return { kind: "choose" as const };
}

export async function activateCompany(organizationId: string) {
	const response = await fetch("/api/companies/active", {
		method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }),
	});
	if (!response.ok) throw new Error("Company activation failed");
}
