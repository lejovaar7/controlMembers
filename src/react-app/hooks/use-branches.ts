import { useCallback, useEffect, useState } from "react";

export type Branch = { id: string; name: string };

type Loaded = {
	organizationId: string;
	organization: { id: string; name: string; role: string } | null;
	branches: Branch[];
	permissions: { allBranches: boolean; canAppointAdmins: boolean };
	failed: boolean;
};

function isBranchList(value: unknown): value is { branches: Branch[]; organization: { id: string; name: string; role: string }; permissions: Loaded["permissions"] } {
	const data = value as { branches?: unknown; organization?: { id?: unknown; name?: unknown; role?: unknown }; permissions?: { allBranches?: unknown; canAppointAdmins?: unknown } } | null;
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray(data?.branches) && data.branches.every((branch: unknown) =>
			typeof branch === "object" && branch !== null && typeof (branch as Branch).id === "string" && typeof (branch as Branch).name === "string") &&
		typeof data.organization?.id === "string" && typeof data.organization.name === "string" && typeof data.organization.role === "string" &&
		typeof data.permissions?.allBranches === "boolean" && typeof data.permissions.canAppointAdmins === "boolean"
	);
}

/**
 * Branches the current user may use in their active organization.
 *
 * The Worker derives this from the validated tenant, so the list reflects the
 * same rules the backend enforces. Results are keyed by organization, so a
 * previous organization's branches are never reported for a new one.
 */
export function useBranches(organizationId: string | null | undefined) {
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [reloadToken, setReloadToken] = useState(0);

	const reload = useCallback(() => setReloadToken((token) => token + 1), []);

	useEffect(() => {
		// Permissions may change in another administrator's session. Revalidate
		// on navigation/focus and periodically; the Worker enforces every access.
		const refresh = () => { if (document.visibilityState === "visible") reload(); };
		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);
		const timer = window.setInterval(refresh, 30_000);
		return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
	}, [reload]);

	useEffect(() => {
		if (!organizationId) return;

		let cancelled = false;

		fetch("/api/branches")
			.then((response) => (response.ok ? response.json() : null))
			.then((data: unknown) => {
				if (cancelled) return;
				setLoaded(
					isBranchList(data) && data.organization.id === organizationId
						? { organizationId, organization: data.organization, branches: data.branches, permissions: data.permissions, failed: false }
						: { organizationId, organization: null, branches: [], permissions: { allBranches: false, canAppointAdmins: false }, failed: true },
				);
			})
			.catch(() => {
				if (!cancelled) {
					setLoaded({ organizationId, organization: null, branches: [], permissions: { allBranches: false, canAppointAdmins: false }, failed: true });
				}
			});

		return () => {
			cancelled = true;
		};
	}, [organizationId, reloadToken]);

	const current =
		organizationId && loaded?.organizationId === organizationId ? loaded : null;

	return {
		branches: current?.branches ?? null,
		organization: current?.organization ?? null,
		permissions: current?.permissions ?? null,
		failed: current?.failed ?? false,
		reload,
	};
}
