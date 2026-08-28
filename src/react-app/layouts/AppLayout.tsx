import { LayoutDashboard, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { BranchSwitcher } from "@/components/branch-switcher";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/hooks/use-branches";
import { activateBranch } from "@/lib/activate-branch";
import { authClient, useListOrganizations, useSession } from "@/lib/auth-client";
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

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-svh items-center justify-center">
			<p className="text-muted-foreground text-sm" role="status">
				{children}
			</p>
		</div>
	);
}

/**
 * Shell for /app/*.
 *
 * The session and tenant checks here are UX only — they route the user to the
 * right screen. Authorization is enforced by the Worker
 * (requireAuth / requireTenant / requireBranch), never here.
 */
export function AppLayout() {
	const { data: session, isPending } = useSession();
	const location = useLocation();
	const [signingOut, setSigningOut] = useState(false);

	const activeOrganizationId = session?.session.activeOrganizationId ?? null;
	const activeBranchId = session?.session.activeTeamId ?? null;
	const { branches, failed: branchesFailed } = useBranches(activeOrganizationId);
	const organizations = useListOrganizations();
	const organizationList = useMemo(
		() => organizations.data ?? [],
		[organizations.data],
	);

	// Recovery only: select an organization the user already belongs to when the
	// session has none active. Nothing is ever created here — companies and
	// branches are provisioned.
	useEffect(() => {
		if (activeOrganizationId || organizations.isPending) return;
		const first = organizationList[0];
		if (!first) return;
		void authClient.organization.setActive({ organizationId: first.id });
	}, [activeOrganizationId, organizations.isPending, organizationList]);

	// Same for the branch: adopt an accessible one rather than stranding the user.
	useEffect(() => {
		if (!session || !branches || branches.length === 0) return;
		if (branches.some((branch) => branch.id === activeBranchId)) return;
		const first = branches[0];
		if (!first) return;
		void activateBranch(first.id, session.user.id);
	}, [session, branches, activeBranchId]);

	async function handleSignOut() {
		if (signingOut) return;
		// While this flag is set the guards below are skipped, so no redirect can
		// fire on a session that is mid-clear. Only once sign-out has resolved do
		// we navigate, which lands on a clean /login with no returnTo.
		setSigningOut(true);
		try {
			await authClient.signOut();
		} finally {
			// A full load discards every cached client atom, so no stale session
			// can bounce the user back through the app guards on the way out.
			window.location.assign("/login");
		}
	}

	if (isPending || signingOut) return <Centered>Loading\u2026</Centered>;

	if (!session) {
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
		);
	}

	// Companies are provisioned, so a user genuinely without one is in an
	// abnormal state rather than one they can repair themselves.
	if (organizations.isPending) return <Centered>Loading\u2026</Centered>;
	if (organizationList.length === 0) {
		return <Navigate to="/no-company" replace />;
	}
	if (!activeOrganizationId) return <Centered>Loading workspace\u2026</Centered>;
	if (branches === null) return <Centered>Loading workspace\u2026</Centered>;
	// A failed lookup is not the same as an empty one: only a genuinely empty
	// organization should be sent to onboarding.
	if (branchesFailed) {
		return <Centered>We could not load your workspace. Try again.</Centered>;
	}
	if (branches.length === 0) return <Navigate to="/no-company" replace />;

	const branchIsUsable = branches.some(
		(branch) => branch.id === activeBranchId,
	);
	if (!branchIsUsable) return <Centered>Loading workspace\u2026</Centered>;

	return (
		<div className="flex min-h-svh flex-col md:flex-row">
			<aside className="border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
				<div className="p-3">
					<Navigation />
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-14 flex-wrap items-center justify-between gap-3 border-b px-4 sm:px-6">
					<div className="flex items-center gap-2">
						<OrganizationSwitcher activeOrganizationId={activeOrganizationId} />
						<BranchSwitcher
							branches={branches}
							activeBranchId={activeBranchId}
							userId={session.user.id}
						/>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground max-w-[12rem] truncate text-sm">
							{session.user.name || session.user.email}
						</span>
						<Button variant="outline" size="sm" onClick={handleSignOut}>
							Sign out
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
