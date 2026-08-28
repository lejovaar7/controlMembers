import { Link, useLocation, useSearchParams } from "react-router";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export function AcceptInvitationPage() {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const { data: session, isPending } = useSession();

	// Presence only. The invitation id is never rendered or logged.
	const hasInvitation = Boolean(searchParams.get("invitationId"));

	if (isPending) return null;

	if (!hasInvitation) {
		return (
			<AuthCard
				title="Invitation"
				description="This link is missing an invitation."
				footer={<Link to="/" className="underline">Go home</Link>}
			>
				{null}
			</AuthCard>
		);
	}

	if (!session) {
		// Preserve the invitation link so login returns to exactly this page.
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<AuthCard
				title="Invitation"
				description="Sign in to continue with this invitation."
			>
				<Button
					className="w-full"
					render={
						<Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />
					}
				>
					Sign in
				</Button>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title="Invitation"
			description="Accepting invitations is not implemented yet."
			footer={<Link to="/app/dashboard" className="underline">Open the app</Link>}
		>
			{null}
		</AuthCard>
	);
}
