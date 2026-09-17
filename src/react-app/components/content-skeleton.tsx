import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
	return <div role="status" className="content-skeleton min-w-0">
		<span className="sr-only">{label}</span>
		<div aria-hidden="true">{children}</div>
	</div>;
}

/** Match record rows on desktop and stacked records on mobile. */
export function ListSkeleton({ label }: { label: string }) {
	return <SkeletonRegion label={label}><div className="overflow-hidden rounded-2xl border bg-card">
		{[0, 1, 2, 3].map(row => <div key={row} className="flex flex-wrap items-center gap-4 border-b p-4 last:border-0 sm:flex-nowrap sm:p-5">
			<Skeleton className="size-10 shrink-0 rounded-xl" />
			<div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-56 max-w-full" /><Skeleton className="h-3 w-28" /></div>
			<Skeleton className="ml-14 h-8 w-24 shrink-0 sm:ml-0" />
		</div>)}
	</div></SkeletonRegion>;
}

function MetricPlaceholders({ count = 4 }: { count?: 3 | 4 }) {
	return <div className={count === 4 ? "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-3"}>
		{Array.from({ length: count }, (_, i) => <div key={i} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
			<Skeleton className="size-9 rounded-xl" /><Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="h-8 w-32 max-w-full" />
		</div>)}
	</div>;
}

export function DashboardSkeleton({ label }: { label: string }) {
	return <SkeletonRegion label={label}><div className="space-y-6">
		<MetricPlaceholders />
		<div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">{[0, 1].map(i => <div key={i} className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
			<Skeleton className="h-5 w-44 max-w-full" /><Skeleton className="h-56 w-full rounded-xl" />
		</div>)}</div>
	</div></SkeletonRegion>;
}

export function FormSkeleton({ label }: { label: string }) {
	return <SkeletonRegion label={label}><div className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
		<Skeleton className="h-5 w-44 max-w-full" />
		<div className="grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-full" /></div>)}</div>
		<Skeleton className="h-11 w-full sm:w-36" />
	</div></SkeletonRegion>;
}

export function DetailSkeleton({ label }: { label: string }) {
	return <SkeletonRegion label={label}><div className="space-y-6">
		<div className="space-y-3 py-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
		<MetricPlaceholders count={3} />
		<div className="grid gap-6 xl:grid-cols-2">{[0, 1].map(i => <div key={i} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
			<Skeleton className="h-5 w-40" />{[0, 1, 2].map(row => <div key={row} className="space-y-3 border-t pt-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}
		</div>)}</div>
	</div></SkeletonRegion>;
}
