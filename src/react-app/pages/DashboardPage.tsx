import { PageContainer, PageHeader } from "@/components/page";
import { useBranches } from "@/hooks/use-branches";
import { useActiveOrganization, useSession } from "@/lib/auth-client";

export function DashboardPage() {
	const { data: session } = useSession();
	const organization = useActiveOrganization();

	const activeOrganizationId = session?.session.activeOrganizationId ?? null;
	const activeBranchId = session?.session.activeTeamId ?? null;
	const { branches } = useBranches(activeOrganizationId);

	const branchName =
		branches?.find((branch) => branch.id === activeBranchId)?.name ?? null;

	return (
		<PageContainer>
			<PageHeader
				title="Dashboard"
				description="Your current company and branch."
			/>
			<dl className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-lg border p-4">
					<dt className="text-muted-foreground text-sm">Company</dt>
					<dd className="text-lg font-medium">
						{organization.data?.name ?? "\u2014"}
					</dd>
				</div>
				<div className="rounded-lg border p-4">
					<dt className="text-muted-foreground text-sm">Branch</dt>
					<dd className="text-lg font-medium">{branchName ?? "\u2014"}</dd>
				</div>
			</dl>
		</PageContainer>
	);
}
