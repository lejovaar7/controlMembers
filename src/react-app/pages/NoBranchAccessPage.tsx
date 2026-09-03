import { PageContainer, PageHeader } from "@/components/page";

/**
 * A member who belongs to the organization but has no branch assignment.
 * Deliberately generic: inaccessible branch names are never revealed, and no
 * branch creation is offered.
 */
export function NoBranchAccessPage() {
	return (
		<PageContainer>
			<PageHeader
				title="No branch access"
				description="You don't have access to any branch yet. Contact an administrator to be assigned to one."
			/>
		</PageContainer>
	);
}
