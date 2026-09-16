import { useT } from "@/lib/i18n";
import { Link } from "react-router";
import { PageContainer, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { authenticatedStartPath } from "@/lib/session-routing";
import { ProductBrand } from "@/components/product-brand";
import { ArrowRight, BadgeCheck, UsersRound, WalletCards } from "lucide-react";

export function HomePage() {
	const t = useT();
	const { data: session, isPending } = useSession();

	return <PageContainer className="flex min-h-[calc(100svh-5rem)] items-center">
		<div className="grid w-full items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
			<div className="max-w-2xl">
				<ProductBrand className="mb-6 h-24 w-full max-w-xl" />
				<PageHeader title={t("ControlMembers")} description={t("Simple recurring fee control for membership organizations.")} />
				{isPending ? null : session ? (
					<Button size="lg" nativeButton={false} render={<Link to={authenticatedStartPath(null, (session.user as { role?: unknown }).role)} />}>{t("Open app")}<ArrowRight /></Button>
				) : (
					<Button size="lg" nativeButton={false} render={<Link to="/login" />}>{t("Sign in")}<ArrowRight /></Button>
				)}
			</div>
			<div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-[#26205c] p-8 shadow-2xl shadow-primary/20">
				<div className="absolute -right-16 -top-16 size-64 rounded-full bg-[#7567f4]/45 blur-2xl" />
				<div className="absolute -bottom-20 -left-16 size-72 rounded-full bg-[#20b486]/15 blur-3xl" />
				<div className="relative grid h-full place-items-center">
					<div className="relative grid size-56 place-items-center rounded-[2.25rem] bg-white text-primary shadow-2xl sm:size-64">
						<UsersRound className="size-28" strokeWidth={1.5} />
						<div className="absolute -right-7 -top-7 grid size-20 place-items-center rounded-3xl bg-[#7567f4] text-white shadow-xl"><BadgeCheck className="size-10" /></div>
						<div className="absolute -bottom-7 -left-7 grid size-20 place-items-center rounded-3xl bg-[#20b486] text-white shadow-xl"><WalletCards className="size-10" /></div>
					</div>
				</div>
			</div>
		</div>
	</PageContainer>;
}
