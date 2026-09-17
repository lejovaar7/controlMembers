import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Check, ShieldCheck, UsersRound } from "lucide-react";
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
		<div className="auth-layout mx-auto grid min-h-[calc(100svh-4.5rem-1px)] w-full max-w-6xl content-center items-stretch gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
			<section className="relative hidden min-h-[34rem] overflow-hidden rounded-3xl bg-[var(--brand-panel)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
				<div aria-hidden="true" className="absolute -right-24 -top-24 size-96 rounded-full border-[50px] border-white/5" />

				<div className="relative flex items-center gap-3 text-sm text-sky-100"><UsersRound className="size-5" />{t("Your workspace, in order.")}</div>
				<div className="relative max-w-md space-y-4">
					<div className="h-1 w-14 rounded-full bg-sky-300" />
					<h2 className="text-4xl font-semibold leading-tight tracking-tight">{t("Less admin. More time for your members.")}</h2>
					<p className="text-lg leading-8 text-white/75">{t("Members, payments and balances. Everything in one place.")}</p>
				</div>
			<p className="relative flex items-center gap-2 text-sm text-sky-100"><Check className="size-4" />{t("A simpler day starts here.")}</p></section>
			<div className="mx-auto flex w-full min-w-0 max-w-md flex-col justify-center lg:min-h-[34rem] lg:max-w-none">

				<Card className="auth-card gap-7 border border-border/80 bg-card py-7 shadow-lg shadow-primary/5 ring-0 hover:shadow-lg sm:py-9">
				<CardHeader className="gap-3 px-5 sm:px-8">
					<div aria-hidden="true" className="mb-2 grid size-11 place-items-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="size-6" /></div>
					<CardTitle className="text-[1.75rem] font-semibold leading-tight tracking-tight"><h1>{title}</h1></CardTitle>
					{description ? <CardDescription className="text-sm leading-6">{description}</CardDescription> : null}
				</CardHeader>
				<CardContent className="px-5 sm:px-8">{children}</CardContent>
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
