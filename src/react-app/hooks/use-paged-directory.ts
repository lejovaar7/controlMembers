import { useEffect, useRef, useState } from "react";

/** A request identity protects both initial results and later page appends. */
export function usePagedDirectory<T>(load: (offset: number, signal: AbortSignal) => Promise<{ rows: T[]; nextOffset: number | null }>) {
	const [revision, setRevision] = useState(0);
	const [result, setResult] = useState<{ source: typeof load; revision: number; rows: T[]; nextOffset: number | null } | null>(null);
	const [failure, setFailure] = useState<{ source: typeof load; revision: number } | null>(null);
	const [moreFailed, setMoreFailed] = useState(false);
	const [morePending, setMorePending] = useState(false);
	const request = useRef<AbortController | null>(null);
	const moreLock = useRef(false);
	useEffect(() => {
		const controller = new AbortController(); request.current = controller; moreLock.current = false;
		const timer = window.setTimeout(() => {
			setMorePending(false); setMoreFailed(false);
			void load(0, controller.signal).then((page) => {
				if (!controller.signal.aborted) { setResult({ ...page, source: load, revision }); setFailure(null); }
			}).catch(() => { if (!controller.signal.aborted) setFailure({ source: load, revision }); });
		}, 200);
		return () => { controller.abort(); window.clearTimeout(timer); };
	}, [load, revision]);
	const current = result?.source === load && result.revision === revision ? result : null;
	const failed = failure?.source === load && failure.revision === revision;
	async function loadMore() {
		const controller = request.current;
		if (!current || current.nextOffset === null || !controller || controller.signal.aborted || moreLock.current) return;
		moreLock.current = true; setMorePending(true); setMoreFailed(false);
		try {
			const page = await load(current.nextOffset, controller.signal);
			if (!controller.signal.aborted) setResult({ ...page, source: load, revision, rows: [...current.rows, ...page.rows] });
		} catch { if (!controller.signal.aborted) setMoreFailed(true); }
		finally { if (!controller.signal.aborted) { moreLock.current = false; setMorePending(false); } }
	}
	return { rows: current?.rows ?? [], nextOffset: current?.nextOffset ?? null, loading: !current && !failed, failed, moreFailed, morePending, loadMore, reload: () => setRevision((value) => value + 1) };
}
