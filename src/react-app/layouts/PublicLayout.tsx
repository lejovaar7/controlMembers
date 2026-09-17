import { useT } from "@/lib/i18n";
import { Link, Outlet } from "react-router";
import { LanguagePicker } from "@/components/language-picker";
import { ProductBrand } from "@/components/product-brand";

export function PublicLayout() {
	const t = useT();
	return (
		<div className="flex min-h-svh flex-col">
			<header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
				<div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
					<Link to="/" aria-label={t("Home")} className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
						<ProductBrand compact className="w-36 sm:w-44" />
					</Link>
					<LanguagePicker />
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
