import { useT } from "@/lib/i18n";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * No active company membership, either unassigned or deactivated. Access is
 * provisioned by administrators, so there is no self-service company creation.
 */
export function NoCompanyPage() {
	const t = useT();
	return (
		<AuthCard
			title={t("No active company access")}
			description={t("Your account has no active company access. Contact your administrator if your access needs to be assigned or restored.")}
		>
			<Button className="w-full" onClick={() => window.location.assign("/app/dashboard")}>{t("Check access again")}</Button>
			<Button
				variant="outline"
				className="w-full"
				onClick={() => {
					void authClient.signOut().then(() => window.location.assign("/login"));
				}}
			>
				{t("Sign out")}</Button>
		</AuthCard>
	);
}
