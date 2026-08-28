import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";

export function PlatformHomePage() {
	return (
		<PageContainer>
			<PageHeader
				title="Companies"
				description="Provision a company and its first owner."
			/>
			<Button render={<Link to="/platform/organizations/new" />}>
				Create company
			</Button>
		</PageContainer>
	);
}
