import { useState } from "react";
import { authClient, useListOrganizations } from "@/lib/auth-client";

/**
 * Lists only organizations the user belongs to. Switching goes through Better
 * Auth, which rejects any organization the user is not a member of, so a
 * tampered value cannot grant access.
 */
export function OrganizationSwitcher({
	activeOrganizationId,
	onSwitching,
	onFailure,
}: {
	activeOrganizationId: string | null;
	onSwitching: (switching: boolean) => void;
	onFailure: () => void;
}) {
	const organizations = useListOrganizations();
	const [switching, setSwitching] = useState(false);
	const [failed, setFailed] = useState(false);

	const list = organizations.data ?? [];
	if (organizations.isPending || list.length === 0) return null;

	async function handleChange(organizationId: string) {
		if (switching || organizationId === activeOrganizationId) return;
		if (!list.some((organization) => organization.id === organizationId)) return;

		setSwitching(true);
		onSwitching(true);
		setFailed(false);
		// Clearing the branch first stops the previous organization's branch
		// staying active while the new organization loads.
		try {
			const cleared = await authClient.organization.setActiveTeam({ teamId: null });
			if (cleared.error) throw new Error("switch failed");
			const activated = await authClient.organization.setActive({ organizationId });
			if (activated.error) throw new Error("switch failed");
		} catch {
			setFailed(true);
			onFailure();
		} finally {
			setSwitching(false);
			onSwitching(false);
		}
	}

	return (
		<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
			<label htmlFor="organization-switcher" className="sr-only">
				Company
			</label>
			<select
				id="organization-switcher"
				className="border-input bg-background focus-visible:ring-ring h-8 min-w-0 max-w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
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
			{failed ? <span role="alert" className="text-destructive text-sm">Could not switch company. Try again.</span> : null}
		</div>
	);
}
