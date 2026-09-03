import { PageContainer, PageHeader } from "@/components/page";
import { useAppShell } from "@/hooks/use-app-shell";

export function SettingsPage() {
	const shell = useAppShell();
	return (
		<PageContainer className="space-y-4">
			<PageHeader title="Settings" description="Your company workspace." />
			<dl className="grid gap-4 rounded-lg border p-4 text-sm">
				<div><dt className="text-muted-foreground">Company</dt><dd>{shell.organizationName}</dd></div>
				<div><dt className="text-muted-foreground">Your role</dt><dd>{shell.organizationRole}</dd></div>
				<div><dt className="text-muted-foreground">Active branch</dt><dd>{shell.activeBranch?.name ?? "No branch selected"}</dd></div>
			</dl>
			<p className="max-w-prose text-sm text-muted-foreground">This starter provides a shared settings area for each company. Product-specific preferences, including locale, timezone and currency editing, can be added here by your application team.</p>
		</PageContainer>
	);
}
