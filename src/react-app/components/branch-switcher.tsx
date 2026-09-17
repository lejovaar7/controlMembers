import { SelectField } from "@/components/select-field";
import { useT } from "@/lib/i18n";
import { Loader } from "@/components/loader";
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
	const t = useT();
	const [switching, setSwitching] = useState(false);
	const [failed, setFailed] = useState(false);

	if (branches.length === 0) return null;

	async function handleChange(branchId: string) {
		if (switching || branchId === activeBranchId) return;
		if (!branches.some((branch) => branch.id === branchId)) return;

		setSwitching(true);
		setFailed(false);
		try {
			setFailed(!(await activateBranch(branchId, userId)));
		} catch {
			setFailed(true);
		} finally {
			setSwitching(false);
		}
	}

	return (
		<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
			<label htmlFor="branch-switcher" className="sr-only">
				{t("Branch")}</label>
			<SelectField id="branch-switcher" className="h-11 min-w-0 max-w-full rounded-lg border border-transparent bg-muted/50 px-2 text-sm text-muted-foreground hover:bg-muted " value={activeBranchId ?? ""} disabled={switching} onValueChange={(value) => void handleChange(value)} options={[...branches.map((branch) => (
					({ value: branch.id, label: branch.name })
				))]} />
			{switching && <Loader size="inline" label={t("Loading workspace…")} />}
			{failed ? <span role="alert" className="text-destructive text-sm">{t("Could not switch branch. Try again.")}</span> : null}
		</div>
	);
}
