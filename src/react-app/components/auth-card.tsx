import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ProductBrand } from "@/components/product-brand";
import { useT } from "@/lib/i18n";

export function AuthCard({
	title,
	description,
	children,
	footer,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
}) {
	const t = useT();
	return (
		<div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
			<section className="relative hidden min-h-[34rem] overflow-hidden rounded-3xl bg-[#26205c] p-10 text-white shadow-2xl shadow-primary/20 lg:flex lg:flex-col lg:justify-between">
				<div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#7567f4]/35 blur-2xl" />
				<div className="absolute -bottom-24 -left-16 size-80 rounded-full bg-[#20b486]/15 blur-3xl" />
				<div className="relative rounded-2xl bg-white p-4 shadow-lg shadow-black/10">
					<ProductBrand className="h-20 w-full" />
				</div>
				<div className="relative max-w-md space-y-4">
					<div className="h-1 w-14 rounded-full bg-[#20b486]" />
					<h2 className="text-3xl font-bold tracking-tight">{t("ControlMembers")}</h2>
					<p className="text-lg leading-8 text-white/75">{t("Simple recurring fee control for membership organizations.")}</p>
				</div>
			</section>
			<div className="flex min-h-[34rem] flex-col justify-center">
				<ProductBrand className="mx-auto mb-5 w-64 lg:hidden" />
				<Card className="border-0 bg-card/95 py-7 shadow-xl shadow-primary/8 ring-1 ring-border/80 backdrop-blur">
				<CardHeader className="gap-2 px-6 sm:px-8">
					<CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
					{description ? <CardDescription>{description}</CardDescription> : null}
				</CardHeader>
				<CardContent className="px-6 sm:px-8">{children}</CardContent>
			</Card>
			{footer ? (
				<div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>
			) : null}
			</div>
		</div>
	);
}

/** Async form status. Announced so screen readers hear failures. */
export function FormMessage({
	tone = "error",
	children,
	id,
}: {
	tone?: "error" | "success";
	children: ReactNode;
	id?: string;
}) {
	if (!children) return null;
	return (
		<p
			id={id}
			role="status"
			aria-live="polite"
			className={
				tone === "error"
					? "text-destructive text-sm"
					: "text-sm text-emerald-700 dark:text-emerald-400"
			}
		>
			{children}
		</p>
	);
}
