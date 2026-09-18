import { Loader } from "@/components/loader";
import { useT } from "@/lib/i18n";
import { Banknote, Building2, CalendarRange, ChartNoAxesCombined, LayoutDashboard, LogOut, MapPin, Menu, X, Settings, UserRoundCheck, Users } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
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
import { roleMessage } from "../../shared/i18n";

const navigation = [
	{ to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, manage: false, reports: true },
	{ to: "/app/customer-members", label: "Members", icon: UserRoundCheck, manage: false },
	{ to: "/app/collections", label: "Collections & payments", icon: Banknote, manage: false },
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
	onNavigate,
}: {
	className?: string;
	showManagement: boolean;
	fullScope: boolean;
	canViewReports: boolean;
	onNavigate?: () => void;
}) {
	const t = useT();
	return (
		<nav aria-label={t("Main")} className={className}>
			<ul className="flex flex-col gap-1">
				{navigation
					.filter((item) => (showManagement || !item.manage) && (!("fullScope" in item) || !item.fullScope || fullScope) && (!("reports" in item) || !item.reports || canViewReports))
					.map(({ to, label, icon: Icon }) => (
					<li key={to}>
						<NavLink
							to={to}
							onClick={onNavigate}
							className={({ isActive }) =>
								cn(
									"group flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
									"hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
									isActive
										? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/5 ring-1 ring-primary/10"
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
	const [menuOpen, setMenuOpen] = useState(false);
	useEffect(() => {
		const desktop = window.matchMedia("(min-width: 1024px)");
		const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
		desktop.addEventListener("change", closeOnDesktop);
		return () => desktop.removeEventListener("change", closeOnDesktop);
	}, []);
	useEffect(() => {
		document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
	}, [location.pathname]);
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

	if (isPending || signingOut) return <Loader size="page" label={t("Loading…")} />;

	if (!session) {
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
		);
	}

	// Companies are provisioned. Unassigned or deactivated access must be
	// restored by an administrator, never through self-service company creation.
	if (!companies) return <Loader size="page" label={t("Loading…")} />;
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
	if (!activeOrganizationId) return <Loader size="page" label={t("Loading workspace…")} />;
	if (branches === null) return <Loader size="page" label={t("Loading workspace…")} />;
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
		return <Loader size="page" label={t("Loading workspace…")} />;
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
		<div className="flex min-h-svh">
			<a href="#main-content" className="skip-link">{t("Skip to content")}</a>
			<aside className="sticky top-0 z-30 hidden h-svh w-62 shrink-0 bg-sidebar shadow-[6px_0_28px_-18px_rgba(15,23,42,0.28)] lg:block">
				<div className="flex h-full min-h-0 flex-col">
					<NavLink to={permissions?.canViewReports ? "/app/dashboard" : "/app/customer-members"} className="mx-4 mt-5 flex min-h-14 items-center rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ProductBrand compact className="w-full" /></NavLink>
					<Navigation className="min-h-0 flex-1 overflow-y-auto px-3 pt-5 pb-5" showManagement={manageBranches} fullScope={permissions?.allBranches === true} canViewReports={permissions?.canViewReports === true} />
					<div className="m-4 rounded-xl bg-muted/50 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 shrink-0 text-primary" /><span className="truncate">{organization?.name}</span></div><p className="text-xs leading-5 text-muted-foreground">{t("Your workspace, in order.")}</p></div>
				</div>
			</aside>
			<div className="flex min-w-0 flex-1 flex-col">
				{isPlatformAdminRole((session.user as { role?: unknown }).role) && <div className="border-b bg-secondary px-4 py-2 text-sm sm:px-6 lg:px-8"><NavLink to="/platform" className="font-medium text-primary">{t("Platform administration")}</NavLink></div>}
				<header className="sticky top-0 z-20 flex min-h-22 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/60 bg-card px-4 py-4 sm:px-6 lg:px-8">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
							<Dialog.Trigger render={<Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-xl bg-muted/50 lg:hidden" aria-label={t("Open navigation")} />}><Menu /></Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" />
								<Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,90vw)] flex-col bg-sidebar shadow-2xl">
									<div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5"><NavLink to={permissions?.canViewReports ? "/app/dashboard" : "/app/customer-members"} onClick={() => setMenuOpen(false)} className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ProductBrand compact className="w-48" /></NavLink><Dialog.Close render={<Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("Close navigation")} />}><X /></Dialog.Close></div>
									<Dialog.Title className="sr-only">{t("Workspace")}</Dialog.Title>
									<Navigation className="min-h-0 flex-1 overflow-y-auto px-4 pt-4" showManagement={manageBranches} fullScope={permissions?.allBranches === true} canViewReports={permissions?.canViewReports === true} onNavigate={() => setMenuOpen(false)} />
									<div className="space-y-4 border-t p-5"><p className="truncate text-sm font-medium">{session.user.name || session.user.email}</p><LanguagePicker compact /><Button variant="outline" className="w-full" onClick={handleSignOut}><LogOut />{t("Sign out")}</Button></div>
								</Dialog.Popup>
							</Dialog.Portal>
						</Dialog.Root>
						<span aria-hidden="true" className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary sm:flex"><Building2 className="size-5" /></span>
						<div className="flex min-w-0 flex-1 flex-col items-start gap-1">
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
							<span className="flex max-w-full items-center gap-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
								<MapPin aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 break-words">{activeBranch.name}</span>
							</span>
						) : null}
						</div>
					</div>
					<div className="hidden shrink-0 items-center gap-4 lg:flex">
						<LanguagePicker compact />
						<div className="flex min-w-0 items-center gap-2.5">
							<span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{(session.user.name || session.user.email).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase()}</span>
							<div className="hidden min-w-0 xl:block"><p className="max-w-36 truncate text-sm font-semibold" title={session.user.name || session.user.email}>{session.user.name || session.user.email}</p><p className="mt-0.5 text-xs text-muted-foreground">{t(roleMessage(organizationRole))}</p></div>
						</div>
						<Button variant="outline" size="sm" className="h-11 rounded-xl border-border/70 bg-transparent px-3 shadow-none" onClick={handleSignOut}>
							<LogOut />{t("Sign out")}</Button>
					</div>
				</header>
				<main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
					{switchingOrganization ? <p role="status" className="p-6">{t("Switching company…")}</p> : <Outlet key={`${activeOrganizationId}:${activeBranchId}`} context={shell} />}
				</main>
			</div>
		</div>
	);
}
