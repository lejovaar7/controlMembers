import { useState } from "react";
import type { Branch } from "@/hooks/use-branches";
import { activateBranch } from "@/lib/activate-branch";

/**
 * Branches come from the Worker, which applies the same access rules the API
 * enforces, so a member never sees a branch they cannot use. Switching goes
 * through Better Auth; activeTeamId is never written directly.
 */
export function BranchSwitcher({
	branches,
	activeBranchId,
	userId,
}: {
	branches: Branch[];
	activeBranchId: string | null;
	userId: string;
}) {
	const [switching, setSwitching] = useState(false);

	if (branches.length === 0) return null;

	async function handleChange(branchId: string) {
		if (switching || branchId === activeBranchId) return;
		if (!branches.some((branch) => branch.id === branchId)) return;

		setSwitching(true);
		await activateBranch(branchId, userId);
		setSwitching(false);
	}

	return (
		<div className="flex items-center gap-2">
			<label htmlFor="branch-switcher" className="sr-only">
				Branch
			</label>
			<select
				id="branch-switcher"
				className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
				value={activeBranchId ?? ""}
				disabled={switching}
				onChange={(event) => void handleChange(event.target.value)}
			>
				{branches.map((branch) => (
					<option key={branch.id} value={branch.id}>
						{branch.name}
					</option>
				))}
			</select>
		</div>
	);
}
