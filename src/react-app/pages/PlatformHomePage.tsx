import { useT } from "@/lib/i18n";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";

export function PlatformHomePage() {
	const t = useT();
	return (
		<PageContainer>
			<PageHeader
				title={t("Companies")}
				description={t("Provision a company and its first owner.")}
			/>
			<Button nativeButton={false} render={<Link to="/platform/organizations/new" />}>
				{t("Create company")}</Button>
		</PageContainer>
	);
}
