import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { CenteredDialog, type DialogReturnFocus } from "@/components/centered-dialog";
import { MoneyInput } from "@/components/money-input";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppShell } from "@/hooks/use-app-shell";
import { billingSetupApi, type BillingSettings, type Plan, type Tag } from "@/lib/billing-setup";
import { useI18n } from "@/lib/i18n";
import { currencyName, formatMoney } from "../../shared/i18n";

function normalizeTag(value: string) {
	return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

/** Creation and editing share the same fields and branch/tag behavior. */
export function PlanEditor({ plan, settings, tags, returnFocus, onClose, onSaved }: {
	plan: Plan | null;
	settings: BillingSettings;
	tags: Tag[];
	returnFocus: DialogReturnFocus;
	onClose: () => void;
	onSaved: (plan: Plan) => void;
}) {
	const { locale, t } = useI18n();
	const shell = useAppShell();
	const [name, setName] = useState(plan?.name ?? "");
	const [description, setDescription] = useState(plan?.description ?? "");
	const [amount, setAmount] = useState(plan ? String(plan.amountMinor / 100) : "");
	const [branchIds, setBranchIds] = useState(plan?.branchIds ?? (shell.activeBranch ? [shell.activeBranch.id] : []));
	const [tagNames, setTagNames] = useState(plan?.tags.map((tag) => tag.name) ?? []);
	const [tagInput, setTagInput] = useState("");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const currency = plan?.currency ?? settings.currency ?? "COP";
	const amountMinor = Math.round(Number(amount) * 100);
	const validAmount = amount.trim() !== "" && Number.isSafeInteger(amountMinor) && amountMinor > 0;
	const suggestedTags = useMemo(() => tags.filter((tag) => !tagNames.some((name) => normalizeTag(name) === normalizeTag(tag.name)) && normalizeTag(tag.name).includes(normalizeTag(tagInput))), [tags, tagNames, tagInput]);

	function addTag(value: string) {
		const next = value.trim().replace(/\s+/g, " ");
		if (!next || next.length > 40 || tagNames.length >= 20 || tagNames.some((tag) => normalizeTag(tag) === normalizeTag(next))) return;
		setTagNames((current) => [...current, next]); setTagInput("");
	}
	function tagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(tagInput); }
		else if (event.key === "Backspace" && !tagInput) setTagNames((current) => current.slice(0, -1));
	}
	async function submit(event: FormEvent) {
		event.preventDefault();
		if (pending || !name.trim() || !validAmount || !branchIds.length || !settings.currency) return;
		setPending(true); setFailed(false);
		try {
			const input = { name: name.trim(), description: description.trim(), amountMinor, defaultDueDay: plan?.defaultDueDay ?? 1, branchIds, tagNames: [...new Map([...tagNames, tagInput.trim()].filter(Boolean).map((tag) => [normalizeTag(tag), tag])).values()] };
			const saved = plan ? await billingSetupApi.updatePlan(shell.organizationId, plan.id, input) : await billingSetupApi.createPlan(shell.organizationId, input);
			onSaved(saved);
		} catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <CenteredDialog open wide title={t(plan ? "Edit plan" : "Add plan")} description={t(plan ? "Changes apply to future enrollments. Existing monthly fees stay unchanged." : "Set the monthly price and where this plan is available.")} pending={pending} returnFocus={returnFocus} onClose={onClose}>
		<form onSubmit={submit} className="space-y-5 px-5 pt-5 pb-6 sm:px-7 sm:pb-7">
			<fieldset disabled={pending} className="min-w-0 space-y-5">
				<div className="grid gap-2"><Label htmlFor="plan-name">{t("Plan name")}</Label><Input id="plan-name" value={name} maxLength={120} required placeholder={t("For example: Children monthly plan")} onChange={(event) => setName(event.target.value)} /></div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid content-start gap-2"><Label htmlFor="plan-amount">{t("Monthly price")}</Label><MoneyInput id="plan-amount" min={0.01} required value={amount} onValueChange={setAmount} aria-describedby="plan-currency" /><p id="plan-currency" className="text-xs text-muted-foreground">{currencyName(locale, currency)}</p></div>
					<p className="rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">{t("The first monthly fee is due at signup. Choose the monthly payment day when adding the member's plan.")}</p>
				</div>
				{shell.branches.length > 1 ? <fieldset className="min-w-0 space-y-2"><legend className="mb-2 text-sm font-medium">{t("Available at branches")}</legend><p className="text-xs leading-5 text-muted-foreground">{t("Select only the branches that should offer this plan.")}</p><div className="grid gap-2 sm:grid-cols-2">{shell.branches.map((branch) => <label key={branch.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${branchIds.includes(branch.id) ? "border-primary/40 bg-accent/40" : "bg-background"}`}><input type="checkbox" className="size-4 shrink-0 accent-primary" checked={branchIds.includes(branch.id)} onChange={(event) => setBranchIds((current) => event.target.checked ? [...current, branch.id] : current.filter((id) => id !== branch.id))} /><span className="min-w-0 break-words">{branch.name}</span></label>)}</div>{!branchIds.length ? <p role="alert" className="text-xs text-destructive">{t("Select at least one branch.")}</p> : null}</fieldset> : null}
				<details className="group rounded-xl border p-4">
					<summary className="cursor-pointer text-sm font-medium">{t("Description and tags (optional)")}</summary>
					<div className="mt-4 space-y-4"><div className="grid gap-2"><Label htmlFor="plan-description">{t("Description (optional)")}</Label><Input id="plan-description" value={description} maxLength={1000} onChange={(event) => setDescription(event.target.value)} /></div>
						<div className="grid gap-2"><Label htmlFor="plan-tags">{t("Tags (optional)")}</Label><div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring/35">{tagNames.map((tag) => <button key={tag} type="button" className="max-w-full rounded-full bg-muted px-2.5 py-1.5 text-xs font-medium break-words" aria-label={t("Remove tag {tag}", { tag })} onClick={() => setTagNames((current) => current.filter((item) => item !== tag))}>{tag} ×</button>)}<input id="plan-tags" className="min-w-0 flex-1 basis-36 bg-transparent text-sm outline-none" value={tagInput} maxLength={40} placeholder={t("Type a tag and press Enter")} onChange={(event) => setTagInput(event.target.value.replace(",", ""))} onKeyDown={tagKeyDown} onBlur={() => addTag(tagInput)} /></div>
							{tagInput.trim() && suggestedTags.length ? <div className="flex flex-wrap gap-2" aria-label={t("Suggested tags")}>{suggestedTags.slice(0, 6).map((tag) => <button key={tag.id} type="button" className="rounded-full border px-3 py-2 text-xs hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag.name)}>{tag.name}</button>)}</div> : null}<p className="text-xs leading-5 text-muted-foreground">{t("Press Enter after each tag. Tags do not change the price or billing rules.")}</p>
						</div>
					</div>
				</details>
			</fieldset>
			{validAmount ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm"><span className="font-semibold tabular-nums">{formatMoney(locale, amountMinor, currency)} <span className="font-normal text-muted-foreground">{t("per month")}</span></span><span className="text-muted-foreground">{t("Payment date chosen at enrollment")}</span></div> : null}
			{failed ? <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{t("We could not save the plan.")}</p> : null}
			<div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("Cancel")}</Button><LoadingButton type="submit" loading={pending} loadingLabel={t("Saving…")} disabled={pending || !name.trim() || !validAmount || !branchIds.length || !settings.currency}>{t(plan ? "Save changes" : "Add plan")}</LoadingButton></div>
		</form>
	</CenteredDialog>;
}
