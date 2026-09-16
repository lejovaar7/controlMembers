import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10", className)}>
			{children}
		</div>
	);
}

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<header className="mb-7 flex flex-wrap items-start justify-between gap-5">
			<div className="max-w-2xl space-y-1.5">
				<h1 className="text-2xl font-bold tracking-[-0.025em] text-foreground sm:text-3xl">{title}</h1>
				{description ? (
					<p className="text-muted-foreground text-sm leading-6 sm:text-base">{description}</p>
				) : null}
			</div>
			{actions}
		</header>
	);
}
