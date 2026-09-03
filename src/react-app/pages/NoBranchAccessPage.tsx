import { useT } from "@/lib/i18n";
import { PageContainer, PageHeader } from "@/components/page";

/**
 * A member who belongs to the organization but has no branch assignment.
 * Deliberately generic: inaccessible branch names are never revealed, and no
 * branch creation is offered.
 */
export function NoBranchAccessPage() {
	const t = useT();
	return (
		<PageContainer>
			<PageHeader
				title={t("No branch access")}
				description={t("You don't have access to any branch yet. Contact an administrator to be assigned to one.")}
			/>
		</PageContainer>
	);
}
