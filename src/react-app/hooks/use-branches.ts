import { useCallback, useEffect, useState } from "react";

export type Branch = { id: string; name: string };

type Loaded = {
	organizationId: string;
	branches: Branch[];
	failed: boolean;
};

function isBranchList(value: unknown): value is { branches: Branch[] } {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as { branches?: unknown }).branches)
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
		if (!organizationId) return;

		let cancelled = false;

		fetch("/api/branches")
			.then((response) => (response.ok ? response.json() : null))
			.then((data: unknown) => {
				if (cancelled) return;
				setLoaded(
					isBranchList(data)
						? { organizationId, branches: data.branches, failed: false }
						: { organizationId, branches: [], failed: true },
				);
			})
			.catch(() => {
				if (!cancelled) {
					setLoaded({ organizationId, branches: [], failed: true });
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
		failed: current?.failed ?? false,
		reload,
	};
}
