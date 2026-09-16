import { useT } from "@/lib/i18n";
import { Banknote, Building2, CalendarRange, ChartNoAxesCombined, ClipboardList, LayoutDashboard, LogOut, MapPin, Settings, UserRoundCheck, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { BranchSwitcher } from "@/components/branch-switcher";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/hooks/use-branches";
import { useCompanies } from "@/hooks/use-companies";
import { activateCompany, companySelection } from "@/lib/companies";
import { activateBranch } from "@/lib/activate-branch";
import type { AppShellContext } from "@/hooks/use-app-shell";
import { canManageBranches } from "@/hooks/use-app-shell";
import {
	authClient,
	useSession,
} from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { LanguagePicker } from "@/components/language-picker";
import { isPlatformAdminRole } from "@/lib/session-routing";
import { ProductBrand } from "@/components/product-brand";

const navigation = [
	{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, manage: false, reports: true },
	{ to: "/app/customer-members", label: "Members", icon: UserRoundCheck, manage: false },
	{ to: "/app/charges", label: "Charges", icon: ClipboardList, manage: false },
	{ to: "/app/payments", label: "Payments", icon: Banknote, manage: false },
	{ to: "/app/billing-setup", label: "Plans", icon: CalendarRange, manage: true, fullScope: true },
	{ to: "/app/reports", label: "Reports", icon: ChartNoAxesCombined, manage: false, reports: true },
	{ to: "/app/branches", label: "Branches", icon: Building2, manage: true, fullScope: false },
	{ to: "/app/members", label: "Users & permissions", icon: Users, manage: true, fullScope: false },
	{ to: "/app/settings", label: "Settings", icon: Settings, manage: false, fullScope: false },
] as const;

function Navigation({
	className,
	showManagement,
	fullScope,
	canViewReports,
}: {
	className?: string;
	showManagement: boolean;
	fullScope: boolean;
	canViewReports: boolean;
}) {
	const t = useT();
	return (
		<nav aria-label={t("Main")} className={className}>
			<ul className="flex gap-2 overflow-x-auto px-1 pb-2 md:flex-col md:overflow-visible md:pb-0">
				{navigation
					.filter((item) => (showManagement || !item.manage) && (!("fullScope" in item) || !item.fullScope || fullScope) && (!("reports" in item) || !item.reports || canViewReports))
					.map(({ to, label, icon: Icon }) => (
					<li key={to}>
						<NavLink
							to={to}
							className={({ isActive }) =>
								cn(
									"group flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
									"hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
									isActive
										? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
										: "text-muted-foreground",
								)
							}
						>
							<Icon aria-hidden="true" className="size-4.5 transition-transform group-hover:scale-105" />
							{t(label)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-svh items-center justify-center p-6">
			<div className="flex max-w-md flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-xl ring-1 ring-border" role="status">
				<ProductBrand className="mb-2 w-56" />
				{children}
			</div>
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
	const t = useT();
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
		permissions,
		failed: branchesFailed,
		reload,
	} = useBranches(activeOrganizationId);
	const { companies, failed: companiesFailed } = useCompanies(userId);
	const selection = companies ? companySelection(companies, activeOrganizationId) : null;
	const selectCompany = useCallback(async (id: string) => {
		setSwitchingOrganization(true);
		try {
			await activateCompany(id);
			// A reload discards the previous company's cached forms and session state.
			window.location.assign(`${location.pathname}${location.search}`);
		} catch { setRecoveryFailed(true); setSwitchingOrganization(false); }
	}, [location.pathname, location.search]);
	const automaticCompanyId = selection?.kind === "activate" ? selection.id : null;
	const automaticActivation = useRef<{ id: string; pending: Promise<void> } | null>(null);

	// Exactly one active membership needs no choice; multiple memberships do.
	useEffect(() => {
		if (!userId || !automaticCompanyId || recoveryFailed || switchingOrganization || companiesFailed) return;
		let cancelled = false;
		if (automaticActivation.current?.id !== automaticCompanyId) {
			automaticActivation.current = { id: automaticCompanyId, pending: activateCompany(automaticCompanyId) };
		}
		void automaticActivation.current.pending
			.then(() => { if (!cancelled) window.location.assign(`${location.pathname}${location.search}`); })
			.catch(() => { if (!cancelled) setRecoveryFailed(true); });
		return () => { cancelled = true; };
	}, [userId, automaticCompanyId, recoveryFailed, switchingOrganization, companiesFailed, location.pathname, location.search]);

	// Same for the branch: adopt an accessible one rather than stranding the user.
	useEffect(() => {
		if (!userId || !branches || branches.length === 0 || recoveryFailed || switchingOrganization || selection?.kind !== "active") return;
		if (branches.some((branch) => branch.id === activeBranchId)) return;
		const first = branches[0];
		if (!first) return;
		void activateBranch(first.id, userId)
			.then((ok) => { if (!ok) setRecoveryFailed(true); })
			.catch(() => setRecoveryFailed(true));
	}, [userId, branches, activeBranchId, recoveryFailed, switchingOrganization, selection?.kind]);

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

	if (isPending || signingOut) return <Centered>{t("Loading…")}</Centered>;

	if (!session) {
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
		);
	}

	// Companies are provisioned. Unassigned or deactivated access must be
	// restored by an administrator, never through self-service company creation.
	if (!companies) return <Centered>{t("Loading…")}</Centered>;
	if (companiesFailed || recoveryFailed) {
		return <Centered>{t("We could not load your workspace.")}<Button variant="outline" onClick={() => window.location.reload()}>{t("Try again")}</Button></Centered>;
	}
	if (selection?.kind === "none") {
		if (isPlatformAdminRole((session.user as { role?: unknown }).role)) return <Navigate to="/platform" replace />;
		return <Navigate to="/no-company" replace />;
	}
	if (selection?.kind === "choose") {
		return <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
			<div className="rounded-3xl bg-card p-7 shadow-xl ring-1 ring-border sm:p-9">
			<ProductBrand className="mb-7 w-64" />
			<div className="mb-4 flex justify-end"><LanguagePicker /></div>
			<h1 className="text-2xl font-semibold">{t("Choose a company")}</h1>
			<p className="mb-6 text-muted-foreground">{t("Select the company you want to work in. Access and permissions are separate for each company.")}</p>
			<div className="grid gap-3">{companies.map((company) => <Button key={company.id} variant="outline" className="h-auto min-h-11 justify-start whitespace-normal break-words" disabled={switchingOrganization} onClick={() => void selectCompany(company.id)}>{company.name}</Button>)}</div>
			{switchingOrganization && <p role="status">{t("Opening company…")}</p>}
			<Button className="mt-3" variant="ghost" disabled={switchingOrganization} onClick={() => void handleSignOut()}><LogOut />{t("Sign out")}</Button>
			</div>
		</div>;
	}
	if (selection?.kind === "activate") return <Centered>{t("Opening company…")}</Centered>;
	if (!activeOrganizationId) return <Centered>{t("Loading workspace…")}</Centered>;
	if (branches === null) return <Centered>{t("Loading workspace…")}</Centered>;
	// A failed lookup is not the same as an empty accessible list.
	if (branchesFailed) {
		return <Centered>{t("We could not load your workspace.")}<Button variant="outline" onClick={reload}>{t("Try again")}</Button></Centered>;
	}
	const organizationRole = organization?.role ?? null;
	const manageBranches = canManageBranches(organizationRole);
	const createBranches = manageBranches && permissions?.allBranches === true;

	if (branches.length === 0) {
		// An owner/unrestricted admin can create the first branch; others have
		// no access and must never be offered branch creation. Both targets live
		// inside this layout, so only redirect when not already there.
		const target = createBranches ? "/app/branches" : "/app/no-branch-access";
		if (location.pathname !== target) {
			return <Navigate to={target} replace />;
		}
	}

	const activeBranch =
		branches.find((branch) => branch.id === activeBranchId) ?? null;
	if (branches.length > 0 && !activeBranch) {
		return <Centered>{t("Loading workspace…")}</Centered>;
	}

	const shell: AppShellContext = {
		organizationId: activeOrganizationId,
		organizationName: organization?.name ?? null,
		branches,
		activeBranch,
		organizationRole,
		canManageBranches: manageBranches,
		canCreateBranches: createBranches,
		allBranches: permissions?.allBranches === true,
		canAppointAdmins: permissions?.canAppointAdmins === true,
		canReversePayments: permissions?.canReversePayments === true,
		canAdjustCharges: permissions?.canAdjustCharges === true,
		canViewReports: permissions?.canViewReports === true,
		canExportFinancialData: permissions?.canExportFinancialData === true,
		refreshBranches: reload,
	};

	return (
		<div className="flex min-h-svh flex-col md:flex-row">
			<aside className="border-b border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:sticky md:top-0 md:h-svh md:w-72 md:shrink-0 md:border-r md:border-b-0">
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-6"><ProductBrand compact className="w-52" /></div>
					<Navigation className="min-h-0 flex-1 overflow-y-auto px-3 md:pb-5" showManagement={manageBranches} fullScope={permissions?.allBranches === true} canViewReports={permissions?.canViewReports === true} />
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-20 flex min-h-17 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<OrganizationSwitcher companies={companies} activeOrganizationId={activeOrganizationId} switching={switchingOrganization} onSelect={(id) => void selectCompany(id)} />
						{branches.length > 1 ? (
							<BranchSwitcher
								branches={branches}
								activeBranchId={activeBranchId}
								userId={session.user.id}
							/>
						) : activeBranch ? (
							// One location: show the branch as a plain label rather than
							// asking the user to choose between one option.
							<span className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
								<MapPin className="size-3.5" />{activeBranch.name}
							</span>
						) : null}
					</div>
					<div className="flex min-w-0 flex-wrap items-center gap-3">
						<LanguagePicker />
						<span className="hidden max-w-[13rem] truncate rounded-lg bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-xs ring-1 ring-border sm:block">
							{session.user.name || session.user.email}
						</span>
						<Button variant="outline" size="sm" onClick={handleSignOut}>
							<LogOut />{t("Sign out")}</Button>
					</div>
				</header>
				<main className="flex-1 bg-background/60">
					{switchingOrganization ? <p role="status" className="p-6">{t("Switching company…")}</p> : <Outlet context={shell} />}
				</main>
			</div>
		</div>
	);
}
