import { PaymentMethodsSettings } from "@/components/payment-methods-settings";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { SelectField } from "@/components/select-field";
import { LoadingButton } from "@/components/loading-button";
import { PageContainer, PageHeader } from "@/components/page";
import { useAppShell } from "@/hooks/use-app-shell";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { LanguagePicker } from "@/components/language-picker";
import { isLocale, localeOptions, roleMessage, type Locale, type LocalePreferences } from "../../shared/i18n";

export function SettingsPage() {
	const shell = useAppShell();
	const { t, preferences } = useI18n();
	const company = preferences?.organization;
	const canManageBilling = shell.organizationRole === "owner" || (shell.organizationRole === "admin" && shell.allBranches);
	return (
		<PageContainer className="max-w-6xl space-y-6">
			<PageHeader title={t("Settings")} description={t("Manage your language, company preferences and payment methods.")} />
			<dl className="grid divide-y rounded-2xl border bg-card text-sm shadow-xs sm:grid-cols-[1.2fr_1fr_1fr] sm:divide-x sm:divide-y-0">
				<div className="min-w-0 p-5 sm:p-6"><dt className="text-muted-foreground">{t("Company")}</dt><dd className="mt-2 break-words text-lg font-semibold tracking-tight">{shell.organizationName}</dd></div>
				<div className="min-w-0 p-5 sm:p-6"><dt className="text-muted-foreground">{t("Your role")}</dt><dd className="mt-2 break-words font-medium">{t(roleMessage(shell.organizationRole))}</dd></div>
				<div className="min-w-0 p-5 sm:p-6"><dt className="text-muted-foreground">{t("Active branch")}</dt><dd className="mt-2 break-words font-medium">{shell.activeBranch?.name ?? t("No branch selected")}</dd></div>
			</dl>
			<div className="grid gap-6 lg:grid-cols-2">
				<section className="flex min-w-0 flex-col rounded-2xl border bg-card shadow-xs">
					<div className="space-y-2 p-5 sm:p-6"><h2 className="font-semibold">{t("My language")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("Choose a language for your account, or use the language configured by the company.")}</p></div>
					<div className="mt-auto space-y-3 border-t p-5 sm:p-6"><LanguagePicker allowCompanyLanguage /><p className="text-xs leading-5 text-muted-foreground">{t("Your language preference is saved automatically.")}</p></div>
				</section>
				{company?.id === shell.organizationId && <CompanyLanguageForm key={company.id} company={company} />}
			</div>
			<PaymentMethodsSettings key={shell.organizationId} />
			<section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
				<div className="min-w-0 space-y-2"><h2 className="font-semibold">{t("Billing settings")}</h2><p className="max-w-prose text-sm leading-6 text-muted-foreground">{t("Currency and billing time are managed in Plans by an owner or an administrator with access to all branches.")}</p></div>
				{canManageBilling ? <Link to="/app/billing-setup" className={buttonVariants({ variant: "outline", className: "w-full shrink-0 sm:w-auto" })}>{t("Open plans")}</Link> : null}
			</section>
		</PageContainer>
	);
}

function CompanyLanguageForm({ company }: { company: NonNullable<LocalePreferences["organization"]> }) {
	const { t, saveCompanyLocale } = useI18n();
	const [draft, setDraft] = useState<Locale | undefined>(undefined);
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<"saved" | "failed" | null>(null);
	const selection = draft ?? company.locale;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending || !company.canEdit) return;
		setPending(true);
		setFeedback(null);
		try { await saveCompanyLocale(selection); setDraft(undefined); setFeedback("saved"); }
		catch { setFeedback("failed"); }
		finally { setPending(false); }
	}
	return <form onSubmit={submit} className="flex min-w-0 flex-col rounded-2xl border bg-card shadow-xs">
		<div className="space-y-2 p-5 sm:p-6"><h2 className="font-semibold">{t("Company language")}</h2>
		<p className="text-sm leading-6 text-muted-foreground">{t("This language is used by people who have not chosen a personal language. Names and other entered data are not translated.")}</p>
		</div>
		<div className="mt-auto space-y-3 border-t p-5 sm:p-6">
		<label htmlFor="company-language" className="sr-only">{t("Company language")}</label>
		<SelectField id="company-language" value={selection} required className="h-11 min-w-0 rounded-md border bg-background px-3 sm:max-w-64" disabled={pending || !company.canEdit} onValueChange={(value) => { if (isLocale(value)) setDraft(value); setFeedback(null); }} options={[...localeOptions.map((option) => ({ value: option.value, lang: option.value, label: option.name }))]} />
		{company.canEdit ? <LoadingButton className="w-full sm:w-auto" loading={pending} loadingLabel={t("Saving…")} type="submit" disabled={pending || selection === company.locale}>{t("Save company language")}</LoadingButton>
			: <p className="text-sm text-muted-foreground">{t("Only a company owner or administrator can change the company language.")}</p>}
		{feedback && <p role={feedback === "failed" ? "alert" : "status"} className="text-sm">{t(feedback === "saved" ? "Company language saved." : "We could not save the language. Please try again.")}</p>}
		</div>
	</form>;
}
