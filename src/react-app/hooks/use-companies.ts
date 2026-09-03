import { useCallback, useEffect, useState } from "react";
import type { Company } from "@/lib/companies";

/** The app shell owns this list; disabled memberships are excluded by the API. */
export function useCompanies(userId: string | undefined) {
	const [loaded, setLoaded] = useState<{ userId: string; companies: Company[]; failed: boolean } | null>(null);
	const [revision, setRevision] = useState(0);
	const reload = useCallback(() => setRevision((value) => value + 1), []);
	useEffect(() => {
		const refresh = () => { if (document.visibilityState === "visible") reload(); };
		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);
		const timer = window.setInterval(refresh, 30_000);
		return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
	}, [reload]);
	useEffect(() => {
		if (!userId) return;
		const controller = new AbortController();
		void fetch("/api/companies", { signal: controller.signal }).then(async (response) => {
			if (!response.ok) throw new Error("Company list unavailable");
			const data = await response.json() as { companies?: unknown };
			if (!Array.isArray(data.companies) || !data.companies.every((entry: unknown) => {
				const company = entry as Company | null;
				return typeof company?.id === "string" && typeof company.name === "string";
			})) throw new Error("Invalid company list");
			if (!controller.signal.aborted) setLoaded({ userId, companies: data.companies as Company[], failed: false });
		}).catch(() => { if (!controller.signal.aborted) setLoaded({ userId, companies: [], failed: true }); });
		return () => controller.abort();
	}, [userId, revision]);
	const current = loaded?.userId === userId ? loaded : null;
	return { companies: current?.companies ?? null, failed: current?.failed ?? false, reload };
}
