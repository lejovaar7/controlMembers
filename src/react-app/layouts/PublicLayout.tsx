import { useT } from "@/lib/i18n";
import { Link, Outlet } from "react-router";
import { LanguagePicker } from "@/components/language-picker";

export function PublicLayout() {
	const t = useT();
	return (
		<div className="flex min-h-svh flex-col">
			<header className="border-b">
				<div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
					<Link to="/" className="font-semibold">
						{t("Home")}</Link>
					<LanguagePicker />
				</div>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
		</div>
	);
}
