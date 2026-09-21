import { useEffect, useState } from "react";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { SelectField } from "@/components/select-field";
import { LoadingButton } from "@/components/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi, type ReminderPreview } from "@/lib/controlmembers";
import { useI18n } from "@/lib/i18n";
import { whatsappReminderUrl } from "@/lib/whatsapp-reminder";
import { formatMoney, type MessageKey } from "../../shared/i18n";

export function WhatsAppReminderDialog({ chargeId, onClose, returnFocus }: { chargeId: string; onClose: (refresh: boolean) => void; returnFocus: DialogReturnFocus }) {
	const shell = useAppShell();
	const { locale, t } = useI18n();
	const [preview, setPreview] = useState<ReminderPreview | null>(null);
	const [recipientId, setRecipientId] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState<MessageKey | null>(null);
	const [pending, setPending] = useState(false);
	const [revision, setRevision] = useState(0);
	const [opened, setOpened] = useState(false);
	const [changed, setChanged] = useState(false);
	useEffect(() => {
		const controller = new AbortController();
		void controlMembersApi.reminder(shell.organizationId, chargeId, controller.signal).then((data) => {
			if (controller.signal.aborted) return;
			setPreview(data); setRecipientId(data.recipients[0]?.id ?? "");
			setMessage(t("Hello! This is {company}. We would like to remind you that {member} has overdue fees at {branch} totaling {amount}, after any available credit. Please contact us if you have already paid or need help. Thank you!", { company: data.companyName, member: data.memberName, branch: data.branchName, amount: formatMoney(locale, data.amountMinor, data.currency) }));
			setError(null);
		}).catch(() => { if (!controller.signal.aborted) setError("We could not prepare the reminder. Try again."); });
		return () => controller.abort();
	}, [shell.organizationId, chargeId, revision, locale, t]);
	const close = () => onClose(revision > 0 || preview?.blockedReason === "not_overdue");
	const recipient = preview?.recipients.find((item) => item.id === recipientId);
	async function openWhatsApp() {
		if (!preview || !recipient || preview.blockedReason || !message.trim() || pending) return;
		// Reserve a user-initiated tab before awaiting the fresh ledger check.
		const tab = window.open("about:blank", "_blank");
		if (!tab) { setError("Allow popups for this site and try again."); return; }
		tab.opener = null;
		setPending(true); setError(null); setOpened(false); setChanged(false);
		try {
			const fresh = await controlMembersApi.reminder(shell.organizationId, chargeId);
			if (JSON.stringify(fresh) !== JSON.stringify(preview)) {
				tab.close(); setRevision((value) => value + 1); setPreview(null);
				setChanged(true);
				return;
			}
			tab.location.replace(whatsappReminderUrl(recipient.phone, message)); setOpened(true);
		} catch { tab.close(); setError("We could not prepare the reminder. Try again."); }
		finally { setPending(false); }
	}
	return <CenteredDialog open wide focusKey={String(revision)} title={t("Remind via WhatsApp")} description={t("Review the phone number and message. You will press Send in WhatsApp.")} pending={pending} onClose={close} returnFocus={returnFocus}>
		<div className="space-y-4 p-5 sm:p-6">
			{!preview && !error ? <div className="space-y-4" role="status" aria-label={t("Loading…")}><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-40 w-full" /></div> : null}
			{preview ? <>
				<div className="rounded-xl border bg-muted/40 p-4 text-sm"><p className="font-semibold">{preview.memberName}</p><p className="mt-1 text-muted-foreground">{preview.branchName}</p><dl className="mt-4 space-y-2">
					{([["Overdue fees", preview.overdueMinor], ["Available credit", preview.creditMinor], ["Amount to request", preview.amountMinor]] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{t(label)}</dt><dd className="font-semibold tabular-nums">{formatMoney(locale, amount, preview.currency)}</dd></div>)}
				</dl><p className="mt-3 text-xs text-muted-foreground">{t("Includes all overdue fees at this branch. Available credit is deducted without changing payments.")}</p></div>
				{preview.blockedReason ? <p role="status" className="rounded-xl bg-muted p-4 text-sm">{t(preview.blockedReason === "credit_covers_debt" ? "Available credit covers the overdue fees. No payment reminder is needed." : "This fee is no longer overdue. Close this dialog and refresh the list.")}</p> : !preview.recipients.length ? <p role="status" className="text-sm">{t("Add a valid phone number with country code to the member or their primary or billing contact first.")}</p> : <>
					<div className="space-y-2"><Label htmlFor="reminder-recipient">{t("Recipient")}</Label><SelectField id="reminder-recipient" value={recipientId} disabled={pending} onValueChange={(value) => { setRecipientId(value); setOpened(false); }} options={preview.recipients.map((item) => ({ value: item.id, label: `${item.name} · ${item.phone}${item.kind === "contact" ? ` · ${t("Contact")}` : ""}` }))} /><p className="text-sm tabular-nums text-muted-foreground">{recipient?.phone}</p></div>
					<div className="space-y-2"><Label htmlFor="reminder-message">{t("Message")}</Label><textarea className="min-h-28 w-full resize-y rounded-xl border bg-background px-3 py-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 sm:text-sm" id="reminder-message" rows={5} maxLength={2000} disabled={pending} value={message} onChange={(event) => { setMessage(event.target.value); setOpened(false); }} /><p className="text-right text-xs text-muted-foreground">{message.length} / 2000</p></div>
				</>}
			</> : null}
			{changed ? <p role="status" className="text-sm text-muted-foreground">{t("The balance or recipient changed. Review the updated draft before continuing.")}</p> : null}
			{error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t(error)}</p>{!preview ? <Button variant="outline" onClick={() => { setError(null); setRevision((value) => value + 1); }}>{t("Try again")}</Button> : null}</div> : null}
			{opened ? <p role="status" className="text-sm text-muted-foreground">{t("WhatsApp opened with your draft. Sending and delivery are confirmed only in WhatsApp.")}</p> : null}
			<div className="flex flex-wrap justify-end gap-3 border-t pt-5"><Button variant="outline" disabled={pending} onClick={close}>{t("Close")}</Button><LoadingButton loading={pending} disabled={!recipient || !!preview?.blockedReason || !message.trim() || message.length > 2000} onClick={() => void openWhatsApp()}>{t("Open WhatsApp")}</LoadingButton></div>
		</div>
	</CenteredDialog>;
}
