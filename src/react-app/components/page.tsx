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
		<div className={cn("mx-auto w-full max-w-5xl px-4 py-8 sm:px-6", className)}>
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
		<header className="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions}
		</header>
	);
}
