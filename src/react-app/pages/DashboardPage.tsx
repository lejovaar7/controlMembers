import { useT } from "@/lib/i18n";
import { PageContainer, PageHeader } from "@/components/page";
import { useAppShell } from "@/hooks/use-app-shell";

export function DashboardPage() {
	const t = useT();
	// Shell state is resolved once by AppLayout, so this page issues no
	// additional branch request.
	const shell = useAppShell();

	return (
		<PageContainer>
			<PageHeader
				title={t("Dashboard")}
				description={t("Your current company and branch.")}
			/>
			<dl className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-lg border p-4">
					<dt className="text-muted-foreground text-sm">{t("Company")}</dt>
					<dd className="text-lg font-medium">
						{shell.organizationName ?? "\u2014"}
					</dd>
				</div>
				<div className="rounded-lg border p-4">
					<dt className="text-muted-foreground text-sm">{t("Branch")}</dt>
					<dd className="text-lg font-medium">
						{shell.activeBranch?.name ?? "\u2014"}
					</dd>
				</div>
			</dl>
		</PageContainer>
	);
}
