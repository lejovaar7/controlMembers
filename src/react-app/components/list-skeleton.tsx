export function ListSkeleton({ label }: { label: string }) {
	return <div role="status" className="overflow-hidden rounded-xl border bg-card">
		<span className="sr-only">{label}</span>
		{[0, 1, 2].map((row) => <div key={row} aria-hidden="true" className="flex items-center gap-4 border-b p-5 last:border-0"><div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-3"><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div><div className="h-5 w-16 animate-pulse rounded bg-muted" /></div>)}
	</div>;
}
