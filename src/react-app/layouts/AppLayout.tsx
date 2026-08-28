import { LayoutDashboard, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigation = [
	{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/app/members", label: "Members", icon: Users },
	{ to: "/app/settings", label: "Settings", icon: Settings },
];

function Navigation({ className }: { className?: string }) {
	return (
		<nav aria-label="Main" className={className}>
			<ul className="flex gap-1 md:flex-col">
				{navigation.map(({ to, label, icon: Icon }) => (
					<li key={to}>
						<NavLink
							to={to}
							className={({ isActive }) =>
								cn(
									"flex items-center gap-2 rounded-md px-3 py-2 text-sm",
									"hover:bg-accent hover:text-accent-foreground",
									isActive
										? "bg-accent text-accent-foreground font-medium"
										: "text-muted-foreground",
								)
							}
						>
							<Icon aria-hidden="true" className="size-4" />
							{label}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}

/**
 * Shell for /app/*.
 *
 * The session check here is UX only — it avoids rendering application chrome to
 * a signed-out visitor. Authorization is enforced by the Worker
 * (requireAuth / requireTenant / requireBranch), never here.
 */
export function AppLayout() {
	const { data: session, isPending } = useSession();
	const location = useLocation();
	const navigate = useNavigate();
	const [signingOut, setSigningOut] = useState(false);

	async function handleSignOut() {
		if (signingOut) return;
		setSigningOut(true);
		await authClient.signOut();
		navigate("/login", { replace: true });
	}

	if (isPending) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<p className="text-muted-foreground text-sm" role="status">
					Loading…
				</p>
			</div>
		);
	}

	if (!session) {
		// Keep the intended destination so login can return the user to it.
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
		);
	}

	return (
		<div className="flex min-h-svh flex-col md:flex-row">
			<aside className="border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
				<div className="p-3">
					<Navigation />
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-14 items-center justify-between gap-4 border-b px-4 sm:px-6">
					<span className="text-sm font-medium">Application</span>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground max-w-[12rem] truncate text-sm">
							{session.user.name || session.user.email}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={handleSignOut}
							disabled={signingOut}
						>
							{signingOut ? "Signing out\u2026" : "Sign out"}
						</Button>
					</div>
				</header>
				<main className="flex-1">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
