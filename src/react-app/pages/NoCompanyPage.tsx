import { useT } from "@/lib/i18n";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Abnormal state: an authenticated user with no organization. Companies are
 * provisioned by the operator, so there is deliberately no self-service repair.
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
