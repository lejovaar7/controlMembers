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
		<div className={cn("page-content mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9", className)}>
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
		<header className="mb-7 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
			<div className="max-w-2xl space-y-1.5">
				<h1 tabIndex={-1} className="text-2xl font-semibold tracking-[-0.035em] text-foreground outline-none sm:text-3xl">{title}</h1>
				{description ? (
					<p className="text-muted-foreground text-sm leading-6">{description}</p>
				) : null}
			</div>
			{actions ? <div className="page-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
		</header>
	);
}
