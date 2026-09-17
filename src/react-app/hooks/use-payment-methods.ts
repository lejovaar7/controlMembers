import { useCallback, useEffect, useState } from "react";
import { controlMembersApi, type PaymentMethod } from "@/lib/controlmembers";
import type { createTranslator } from "../../shared/i18n";

export function paymentMethodLabel(method: { id: string; name: string | null }, t: ReturnType<typeof createTranslator>) {
	if (method.name !== null) return method.name;
	return t(method.id === "cash" ? "Cash" : method.id === "bank_transfer" ? "Bank transfer" : method.id === "card" ? "Card" : "Other");
}

export function usePaymentMethods(organizationId: string, mode: "active" | "inactive" | "history" = "active") {
	const [revision, setRevision] = useState(0);
	const [state, setState] = useState<{ organizationId: string; methods: PaymentMethod[]; canManage: boolean; failed: boolean; loading: boolean } | null>(null);
	const reload = useCallback(() => setRevision((value) => value + 1), []);
	useEffect(() => {
		let active = true;
		void controlMembersApi.paymentMethods(organizationId, mode)
			.then((result) => { if (active) setState({ ...result, organizationId, failed: false, loading: false }); })
			.catch(() => { if (active) setState({ organizationId, methods: [], canManage: false, failed: true, loading: false }); });
		return () => { active = false; };
	}, [organizationId, mode, revision]);
	useEffect(() => { window.addEventListener("focus", reload); return () => window.removeEventListener("focus", reload); }, [reload]);
	return { ...(state?.organizationId === organizationId ? state : { methods: [], canManage: false, failed: false, loading: true }), reload };
}
