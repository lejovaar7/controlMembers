import { ProductBrand } from "@/components/product-brand";
import { useT } from "@/lib/i18n";
import { Link, Navigate, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";
import { LanguagePicker } from "@/components/language-picker";
import { isPlatformAdminRole } from "@/lib/session-routing";

/**
 * Platform administration shell.
 *
 * This is platform scope, not tenant scope: an organization owner or admin is
 * never a platform admin. The guard is UX only — every platform endpoint
 * re-checks with requirePlatformAdmin().
 */
export function PlatformLayout() {
	const t = useT();
	const { data: session, isPending } = useSession();

	if (isPending) return null;
	if (!session) return <Navigate to="/login?returnTo=%2Fplatform" replace />;
	if (!isPlatformAdminRole((session.user as { role?: unknown }).role)) {
		return <Navigate to="/app/dashboard" replace />;
	}

	return (
		<div className="flex min-h-svh flex-col">
			<header className="flex min-h-22 flex-wrap items-center justify-between gap-4 border-b bg-card px-4 py-4 sm:px-8">
				<Link to="/platform" className="text-sm font-medium">
					<ProductBrand compact className="mb-1 w-48" /><span className="text-xs text-muted-foreground">{t("Platform administration")}</span></Link>
				<div className="flex min-w-0 flex-wrap items-center gap-3">
					<Link to="/platform" className="text-sm font-medium text-primary">{t("Companies")}</Link>
					<LanguagePicker />
					<span className="text-muted-foreground hidden max-w-[12rem] truncate text-sm sm:block">
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
						{t("Sign out")}</Button>
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
