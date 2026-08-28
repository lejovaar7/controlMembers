import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Abnormal state: an authenticated user with no organization. Companies are
 * provisioned by the operator, so there is deliberately no self-service repair.
 */
export function NoCompanyPage() {
	return (
		<AuthCard
			title="No company assigned"
			description="Your account is not assigned to a company yet. Contact your administrator."
		>
			<Button
				variant="outline"
				className="w-full"
				onClick={() => {
					void authClient.signOut().then(() => window.location.assign("/login"));
				}}
			>
				Sign out
			</Button>
		</AuthCard>
	);
}
