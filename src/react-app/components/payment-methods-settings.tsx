import { useRef, useState, type FormEvent } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Plus } from "lucide-react";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { ListSkeleton } from "@/components/content-skeleton";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionDialog } from "@/hooks/use-action-dialog";
import { useAppShell } from "@/hooks/use-app-shell";
import { paymentMethodLabel, usePaymentMethods } from "@/hooks/use-payment-methods";
import { controlMembersApi, type PaymentMethod } from "@/lib/controlmembers";
import { useT } from "@/lib/i18n";

export function PaymentMethodsSettings() {
	const t = useT();
	const { organizationId } = useAppShell();
	const catalog = usePaymentMethods(organizationId, "inactive");
	const { dialog, openDialog } = useActionDialog();
	const [editing, setEditing] = useState<{ method: PaymentMethod | null; trigger: HTMLElement } | null>(null);
	function toggle(method: PaymentMethod) {
		openDialog({ title: t(method.isActive ? "Deactivate payment method" : "Activate payment method"), description: t(method.isActive ? "This method will no longer be available for new payments. Previous payments will stay unchanged." : "This method will be available when recording a payment."), confirmLabel: t(method.isActive ? "Deactivate" : "Activate"), destructive: method.isActive,
			summary: <p className="font-medium break-words">{paymentMethodLabel(method, t)}</p>,
			onConfirm: async () => { await controlMembersApi.updatePaymentMethod(organizationId, method.id, { isActive: !method.isActive }); catalog.reload(); },
		});
	}
	return <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
		{dialog}
		<div className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
			<h2 className="order-1 font-semibold">{t("Payment methods")}</h2>
			{catalog.canManage ? <Button type="button" className="order-3 w-full sm:order-2 sm:col-start-2 sm:row-start-1 sm:w-auto" onClick={(event) => setEditing({ method: null, trigger: event.currentTarget })}><Plus aria-hidden="true" />{t("Add payment method")}</Button> : null}
			<p className="order-2 text-sm leading-6 text-muted-foreground sm:order-3 sm:col-span-2">{t("Cash is always available. Add the other payment methods your company accepts.")}</p>
		</div>
		<div className="border-t px-5 sm:px-6">
			{catalog.loading ? <div className="py-5"><ListSkeleton label={t("Loading payment methods…")} /></div> : catalog.failed ? <div role="alert" className="space-y-3 py-5"><p>{t("We could not load payment methods.")}</p><Button type="button" variant="outline" onClick={catalog.reload}>{t("Try again")}</Button></div> : <ul className="divide-y">{catalog.methods.map((method) => <li key={method.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"><p className="min-w-0 break-words font-medium">{paymentMethodLabel(method, t)}</p><StatusBadge tone={method.readOnly || !method.isActive ? "neutral" : "success"}>{t(method.readOnly ? "Default payment method" : method.isActive ? "Active" : "Inactive")}</StatusBadge></div>
				{catalog.canManage && !method.readOnly ? <div className="flex shrink-0 flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={(event) => setEditing({ method, trigger: event.currentTarget })}>{t("Edit")}</Button><Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => toggle(method)}>{t(method.isActive ? "Deactivate" : "Activate")}</Button></div> : null}
			</li>)}</ul>}
		</div>
		{!catalog.loading && !catalog.failed && !catalog.canManage ? <p className="border-t bg-muted/20 px-5 py-4 text-sm leading-6 text-muted-foreground sm:px-6">{t("Only an owner or administrator with access to all branches can manage payment methods.")}</p> : null}
		{editing ? <PaymentMethodForm key={editing.method?.id ?? "new"} organizationId={organizationId} method={editing.method} returnFocus={editing.trigger} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); catalog.reload(); }} /> : null}
	</section>;
}

function PaymentMethodForm({ organizationId, method, returnFocus, onClose, onSaved }: { organizationId: string; method: PaymentMethod | null; returnFocus: DialogReturnFocus; onClose: () => void; onSaved: () => void }) {
	const t = useT();
	const [name, setName] = useState(method?.name ?? "");
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<"duplicate" | "failed" | null>(null);
	const busyRef = useRef(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busyRef.current || !name.trim()) return;
		busyRef.current = true; setPending(true); setFailure(null);
		try { if (method) await controlMembersApi.updatePaymentMethod(organizationId, method.id, { name }); else await controlMembersApi.createPaymentMethod(organizationId, name); onSaved(); }
		catch (error) { setFailure(error instanceof Error && error.message === "PAYMENT_METHOD_NAME_EXISTS" ? "duplicate" : "failed"); }
		finally { busyRef.current = false; setPending(false); }
	}
	return <CenteredDialog open title={t(method ? "Edit payment method" : "Add payment method")} description={t("Choose a clear name, for example Nequi or bank transfer.")} pending={pending} onClose={onClose} returnFocus={returnFocus}>
		<form onSubmit={submit} className="space-y-5 px-5 pt-5 sm:px-7" aria-busy={pending}>
			<div className="grid gap-2"><Label htmlFor="payment-method-name">{t("Name")}</Label><Input id="payment-method-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={pending} /></div>
			{failure ? <p role="alert" className="text-sm text-destructive">{t(failure === "duplicate" ? "A payment method with this name already exists, including inactive methods." : "We could not save the payment method. Please try again.")}</p> : null}
			<div className="-mx-5 flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-4 sm:-mx-7 sm:flex-row sm:justify-end sm:px-7"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !name.trim()}>{t("Save payment method")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}
