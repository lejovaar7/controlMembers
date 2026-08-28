import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export function HomePage() {
	const { data: session, isPending } = useSession();

	return (
		<PageContainer>
			<PageHeader
				title="SaaS Template"
				description="React, Vite, Hono and Cloudflare Workers."
			/>
			{isPending ? null : session ? (
				<Button render={<Link to="/app/dashboard" />}>Open app</Button>
			) : (
				<div className="flex gap-3">
					<Button render={<Link to="/login" />}>Sign in</Button>
					<Button variant="outline" render={<Link to="/register" />}>
						Create account
					</Button>
				</div>
			)}
		</PageContainer>
	);
}
