import { useT } from "@/lib/i18n";
import { Link, Outlet, useLocation } from "react-router";
import { LanguagePicker } from "@/components/language-picker";
import { ProductBrand } from "@/components/product-brand";
import { ArrowUpRight } from "lucide-react";

export function PublicLayout() {
	const t = useT();
	const isHome = useLocation().pathname === "/";
	return (
		<div className="flex min-h-svh flex-col">
			{isHome && <a href="#landing-title" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4">{t("Skip to content")}</a>}
			<header className={`sticky top-0 z-30 border-b border-border/70 backdrop-blur-xl ${isHome ? "bg-white/95" : "bg-background/85"}`}>
				<div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
					<Link to="/" aria-label={t("Home")} className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
						<ProductBrand compact className="w-36 sm:w-44" />
					</Link>
					{isHome ? <div className="flex items-center gap-2 sm:gap-5"><nav aria-label={t("Main navigation")} className="hidden items-center gap-7 text-xs text-muted-foreground lg:flex"><a href="#product" className="py-3 hover:text-primary">{t("The product")}</a><a href="#workflow" className="py-3 hover:text-primary">{t("How it works")}</a><a href="#questions" className="py-3 hover:text-primary">{t("Questions")}</a></nav><LanguagePicker compact /><Link to="/login" className="hidden min-h-11 items-center gap-3 rounded-lg border border-border px-4 text-xs font-medium hover:bg-muted sm:flex">{t("Sign in")}<ArrowUpRight size={14} aria-hidden="true" /></Link></div> : <LanguagePicker />}
				</div>
			</header>
			<main className="flex-1">
				{isHome && <nav aria-label={t("Page sections")} className="flex flex-wrap items-center justify-center gap-x-6 border-b bg-white px-4 text-xs text-muted-foreground lg:hidden"><a href="#product" className="inline-flex min-h-11 items-center">{t("The product")}</a><a href="#workflow" className="inline-flex min-h-11 items-center">{t("How it works")}</a><Link to="/login" className="inline-flex min-h-11 items-center text-primary sm:hidden">{t("Sign in")}</Link><a href="#questions" className="hidden min-h-11 items-center sm:inline-flex">{t("Questions")}</a></nav>}
				<Outlet />
			</main>
		</div>
	);
}
