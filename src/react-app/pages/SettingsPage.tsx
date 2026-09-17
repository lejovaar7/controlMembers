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
	return (
		<PageContainer className="space-y-4">
			<PageHeader title={t("Settings")} description={t("Your company workspace.")} />
			<dl className="grid gap-6 rounded-xl border bg-card p-6 text-sm sm:grid-cols-3">
				<div><dt className="text-muted-foreground">{t("Company")}</dt><dd className="mt-1.5 font-semibold">{shell.organizationName}</dd></div>
				<div><dt className="text-muted-foreground">{t("Your role")}</dt><dd className="mt-1.5 font-semibold">{t(roleMessage(shell.organizationRole))}</dd></div>
				<div><dt className="text-muted-foreground">{t("Active branch")}</dt><dd className="mt-1.5 font-semibold">{shell.activeBranch?.name ?? t("No branch selected")}</dd></div>
			</dl>
			<section className="grid max-w-3xl gap-4 rounded-xl border bg-card p-6">
				<h2 className="font-medium">{t("My language")}</h2>
				<p className="text-sm text-muted-foreground">{t("Choose a language for your account, or use the language configured by the company.")}</p>
				<LanguagePicker />
			</section>
			{company?.id === shell.organizationId && <CompanyLanguageForm key={company.id} company={company} />}
			<p className="max-w-prose text-sm text-muted-foreground">{t("Currency and billing time are managed in Plans by an owner or an administrator with access to all branches.")}</p>
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
	return <form onSubmit={submit} className="grid max-w-3xl gap-4 rounded-xl border bg-card p-6">
		<label htmlFor="company-language" className="font-medium">{t("Company language")}</label>
		<p className="text-sm text-muted-foreground">{t("This language is used by people who have not chosen a personal language. Names and other entered data are not translated.")}</p>
		<select id="company-language" value={selection} required className="h-10 min-w-0 rounded-md border bg-background px-3" disabled={pending || !company.canEdit}
			onChange={(event) => { if (isLocale(event.target.value)) setDraft(event.target.value); setFeedback(null); }}>
			{localeOptions.map((option) => <option key={option.value} value={option.value} lang={option.value}>{option.name}</option>)}
		</select>
		{company.canEdit ? <LoadingButton loading={pending} loadingLabel={t("Saving…")} type="submit" disabled={pending}>{t("Save company language")}</LoadingButton>
			: <p className="text-sm text-muted-foreground">{t("Only a company owner or administrator can change the company language.")}</p>}
		{feedback && <p role={feedback === "failed" ? "alert" : "status"} className="text-sm">{t(feedback === "saved" ? "Company language saved." : "We could not save the language. Please try again.")}</p>}
	</form>;
}
