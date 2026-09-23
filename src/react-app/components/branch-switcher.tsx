import { SelectField } from "@/components/select-field";
import { useT } from "@/lib/i18n";
import type { Branch } from "@/hooks/use-branches";

/**
 * Branches come from the Worker, which applies the same access rules the API
 * enforces, so a member never sees a branch they cannot use. Switching goes
 * through Better Auth; activeTeamId is never written directly.
 */
export function BranchSwitcher({
	branches,
	activeBranchId,
	switching,
	failed,
	onSelect,
}: {
	branches: Branch[];
	activeBranchId: string | null;
	switching: boolean;
	failed: boolean;
	onSelect: (branchId: string) => void;
}) {
	const t = useT();
	if (branches.length === 0) return null;

	return (
		<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
			<label htmlFor="branch-switcher" className="sr-only">
				{t("Branch")}</label>
			<SelectField id="branch-switcher" className="h-11 min-w-0 max-w-full rounded-lg border border-transparent bg-muted/50 px-2 text-sm text-muted-foreground hover:bg-muted " value={activeBranchId ?? ""} disabled={switching} onValueChange={onSelect} options={[...branches.map((branch) => (
					({ value: branch.id, label: branch.name })
				))]} />
			{failed ? <span role="alert" className="text-destructive text-sm">{t("Could not switch branch. Try again.")}</span> : null}
		</div>
	);
}
