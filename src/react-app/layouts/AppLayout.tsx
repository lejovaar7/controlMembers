import { Building2, LayoutDashboard, Settings, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { BranchSwitcher } from "@/components/branch-switcher";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/hooks/use-branches";
import { activateBranch } from "@/lib/activate-branch";
import type { AppShellContext } from "@/hooks/use-app-shell";
import { canManageBranches } from "@/hooks/use-app-shell";
import {
	authClient,
	useListOrganizations,
	useSession,
} from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navigation = [
	{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, manage: false },
	{ to: "/app/branches", label: "Branches", icon: Building2, manage: true },
	{ to: "/app/members", label: "Members", icon: Users, manage: true },
	{ to: "/app/settings", label: "Settings", icon: Settings, manage: false },
];

function Navigation({
	className,
	showManagement,
}: {
	className?: string;
	showManagement: boolean;
}) {
	return (
		<nav aria-label="Main" className={className}>
			<ul className="flex flex-wrap gap-1 md:flex-col">
				{navigation
					.filter((item) => showManagement || !item.manage)
					.map(({ to, label, icon: Icon }) => (
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
	const [recoveryFailed, setRecoveryFailed] = useState(false);
	const [switchingOrganization, setSwitchingOrganization] = useState(false);
	const userId = session?.user.id;

	const activeOrganizationId = session?.session.activeOrganizationId ?? null;
	const activeBranchId = session?.session.activeTeamId ?? null;
	const {
		branches,
		organization,
		failed: branchesFailed,
		reload,
	} = useBranches(activeOrganizationId);
	const organizations = useListOrganizations();
	const organizationList = useMemo(
		() => organizations.data ?? [],
		[organizations.data],
	);

	// Recovery only: select an organization the user already belongs to when the
	// session has none active. Nothing is ever created here — companies and
	// branches are provisioned.
	useEffect(() => {
		if (!userId || activeOrganizationId || organizations.isPending || recoveryFailed || switchingOrganization) return;
		const first = organizationList[0];
		if (!first) return;
		void authClient.organization.setActive({ organizationId: first.id })
			.then((result) => { if (result.error) setRecoveryFailed(true); })
			.catch(() => setRecoveryFailed(true));
	}, [userId, activeOrganizationId, organizations.isPending, organizationList, recoveryFailed, switchingOrganization]);

	// Same for the branch: adopt an accessible one rather than stranding the user.
	useEffect(() => {
		if (!userId || !branches || branches.length === 0 || recoveryFailed || switchingOrganization) return;
		if (branches.some((branch) => branch.id === activeBranchId)) return;
		const first = branches[0];
		if (!first) return;
		void activateBranch(first.id, userId)
			.then((ok) => { if (!ok) setRecoveryFailed(true); })
			.catch(() => setRecoveryFailed(true));
	}, [userId, branches, activeBranchId, recoveryFailed, switchingOrganization]);

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
	if (organizations.error || recoveryFailed) {
		return <Centered>We could not load your workspace. <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button></Centered>;
	}
	if (organizationList.length === 0) {
		return <Navigate to="/no-company" replace />;
	}
	if (!activeOrganizationId) return <Centered>Loading workspace\u2026</Centered>;
	if (branches === null) return <Centered>Loading workspace\u2026</Centered>;
	// A failed lookup is not the same as an empty accessible list.
	if (branchesFailed) {
		return <Centered>We could not load your workspace. <Button variant="outline" onClick={reload}>Try again</Button></Centered>;
	}
	const organizationRole = organization?.role ?? null;
	const manageBranches = canManageBranches(organizationRole);

	if (branches.length === 0) {
		// An owner/admin can still create the first branch; a member simply has
		// no access and must never be offered branch creation. Both targets live
		// inside this layout, so only redirect when not already there.
		const target = manageBranches ? "/app/branches" : "/app/no-branch-access";
		if (location.pathname !== target) {
			return <Navigate to={target} replace />;
		}
	}

	const activeBranch =
		branches.find((branch) => branch.id === activeBranchId) ?? null;
	if (branches.length > 0 && !activeBranch) {
		return <Centered>Loading workspace\u2026</Centered>;
	}

	const shell: AppShellContext = {
		organizationId: activeOrganizationId,
		organizationName: organization?.name ?? null,
		branches,
		activeBranch,
		organizationRole,
		canManageBranches: manageBranches,
		refreshBranches: reload,
	};

	return (
		<div className="flex min-h-svh flex-col md:flex-row">
			<aside className="border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
				<div className="p-3">
					<Navigation showManagement={manageBranches} />
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<OrganizationSwitcher activeOrganizationId={activeOrganizationId} onSwitching={setSwitchingOrganization} onFailure={() => setRecoveryFailed(true)} />
						{branches.length > 1 ? (
							<BranchSwitcher
								branches={branches}
								activeBranchId={activeBranchId}
								userId={session.user.id}
							/>
						) : activeBranch ? (
							// One location: show the branch as a plain label rather than
							// asking the user to choose between one option.
							<span className="text-muted-foreground text-sm">
								{activeBranch.name}
							</span>
						) : null}
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
					{switchingOrganization ? <p role="status" className="p-6">Switching company…</p> : <Outlet context={shell} />}
				</main>
			</div>
		</div>
	);
}
