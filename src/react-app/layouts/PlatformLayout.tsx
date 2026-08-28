import { Link, Navigate, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";

function isPlatformAdmin(role: unknown): boolean {
	return typeof role === "string" && role.split(",").includes("admin");
}

/**
 * Platform administration shell.
 *
 * This is platform scope, not tenant scope: an organization owner or admin is
 * never a platform admin. The guard is UX only — every platform endpoint
 * re-checks with requirePlatformAdmin().
 */
export function PlatformLayout() {
	const { data: session, isPending } = useSession();

	if (isPending) return null;
	if (!session) return <Navigate to="/login?returnTo=%2Fplatform" replace />;
	if (!isPlatformAdmin((session.user as { role?: unknown }).role)) {
		return <Navigate to="/app/dashboard" replace />;
	}

	return (
		<div className="flex min-h-svh flex-col">
			<header className="flex h-14 items-center justify-between gap-4 border-b px-4 sm:px-6">
				<Link to="/platform" className="text-sm font-medium">
					Platform administration
				</Link>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground max-w-[12rem] truncate text-sm">
						{session.user.name || session.user.email}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							void authClient
								.signOut()
								.then(() => window.location.assign("/login"));
						}}
					>
						Sign out
					</Button>
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
