import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-10">
			<Card>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					{description ? <CardDescription>{description}</CardDescription> : null}
				</CardHeader>
				<CardContent>{children}</CardContent>
			</Card>
			{footer ? (
				<div className="text-muted-foreground text-center text-sm">{footer}</div>
			) : null}
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
