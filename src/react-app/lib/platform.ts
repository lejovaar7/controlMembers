export type PlatformOwner = { id: string; name: string; email: string; isActive: boolean; setupRequired: boolean };
export type PlatformCompany = {
	id: string; name: string; slug: string; locale: string; currency: string | null; timezone: string | null;
	createdAt: string; branchCount: number; activeUserCount: number; canOpenWorkspace: boolean; owners: PlatformOwner[];
};
export type CompanyDirectory = { organizations: PlatformCompany[]; total: number; nextOffset: number | null };
export type CompanyDetail = PlatformCompany & { branches: Array<{ id: string; name: string }> };

export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`/api/platform/${path}`, init);
	if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "REQUEST_FAILED");
	return response.json() as Promise<T>;
}
