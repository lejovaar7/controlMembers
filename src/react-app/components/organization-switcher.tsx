import { useState } from "react";
import type { Branch } from "@/hooks/use-branches";
import { authClient, useListOrganizations } from "@/lib/auth-client";

/**
 * Lists only organizations the user belongs to. Switching goes through Better
 * Auth, which rejects any organization the user is not a member of, so a
 * tampered value cannot grant access.
 */
export function OrganizationSwitcher({
	activeOrganizationId,
	onSwitched,
}: {
	activeOrganizationId: string | null;
	onSwitched?: (branches: Branch[] | null) => void;
}) {
	const organizations = useListOrganizations();
	const [switching, setSwitching] = useState(false);

	const list = organizations.data ?? [];
	if (organizations.isPending || list.length === 0) return null;

	async function handleChange(organizationId: string) {
		if (switching || organizationId === activeOrganizationId) return;
		if (!list.some((organization) => organization.id === organizationId)) return;

		setSwitching(true);
		// Clearing the branch first stops the previous organization's branch
		// staying active while the new organization loads.
		await authClient.organization.setActiveTeam({ teamId: null });
		await authClient.organization.setActive({ organizationId });
		setSwitching(false);
		onSwitched?.(null);
	}

	return (
		<div className="flex items-center gap-2">
			<label htmlFor="organization-switcher" className="sr-only">
				Company
			</label>
			<select
				id="organization-switcher"
				className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
				value={activeOrganizationId ?? ""}
				disabled={switching}
				onChange={(event) => void handleChange(event.target.value)}
			>
				{list.map((organization) => (
					<option key={organization.id} value={organization.id}>
						{organization.name}
					</option>
				))}
			</select>
		</div>
	);
}
