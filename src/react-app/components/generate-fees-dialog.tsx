import { useEffect, useState } from "react";
import { CenteredDialog } from "@/components/centered-dialog";
import { MonthPicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/loading-button";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { controlMembersApi } from "@/lib/controlmembers";
import { billingSetupApi } from "@/lib/billing-setup";
import { useT } from "@/lib/i18n";

export function GenerateFeesDialog({ trigger, onClose, onSaved }: { trigger: HTMLElement; onClose: () => void; onSaved: (result: { created: number; alreadyExisting: number }) => void }) {
	const shell = useAppShell(); const t = useT();
	const [period, setPeriod] = useState(""); const [pending, setPending] = useState(false); const [failed, setFailed] = useState(false); const [revision, setRevision] = useState(0);
	const [preview, setPreview] = useState<{ willCreate: number; alreadyExisting: number } | null>(null);
	useEffect(() => { let active = true; void billingSetupApi.settings(shell.organizationId).then((settings) => {
		if (active) { const parts = new Intl.DateTimeFormat("en", { timeZone: settings.timezone ?? "UTC", year: "numeric", month: "2-digit" }).formatToParts(new Date()); setPeriod(`${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`); setFailed(false); }
	}).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [shell.organizationId, revision]);
	async function submit() {
		if (pending || !period) return;
		setPending(true); setFailed(false);
		try { if (!preview) setPreview(await controlMembersApi.previewChargeGeneration(shell.organizationId, period)); else onSaved(await controlMembersApi.generateCharges(shell.organizationId, period)); }
		catch { setFailed(true); } finally { setPending(false); }
	}
	return <CenteredDialog open title={t("Generate monthly charges")} description={t("Choose the month to generate. Existing fees will not change.")} pending={pending} onClose={onClose} returnFocus={trigger}>
		<div className="space-y-5 p-5 sm:p-7"><fieldset disabled={pending} className="grid gap-2"><Label htmlFor="generate-period">{t("Billing period")}</Label><MonthPicker id="generate-period" label={t("Billing period")} value={period} onChange={(value) => { setPeriod(value); setPreview(null); }} /></fieldset>
			{preview ? <p className="rounded-xl bg-muted p-4 text-sm">{t("Generate {count} missing charges for {period}? {existing} already exist and will not change.", { count: preview.willCreate, period, existing: preview.alreadyExisting })}</p> : null}
			{failed ? <div role="alert"><p>{t("We could not load or update charges.")}</p>{!period ? <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>{t("Try again")}</Button> : null}</div> : null}
			<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button><LoadingButton loading={pending} disabled={!period || pending} onClick={() => void submit()}>{t(preview ? "Generate monthly charges" : "Review generation")}</LoadingButton></div>
		</div>
	</CenteredDialog>;
}
