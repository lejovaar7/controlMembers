import { PageContainer, PageHeader } from "@/components/page";
import { useAppShell } from "@/hooks/use-app-shell";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/language-picker";
import { DEFAULT_LOCALE, isLocale, languages, localeOptions, roleMessage, type Locale, type LocalePreferences } from "../../shared/i18n";

export function SettingsPage() {
	const shell = useAppShell();
	const { t, preferences } = useI18n();
	const company = preferences?.organization;
	return (
		<PageContainer className="space-y-4">
			<PageHeader title={t("Settings")} description={t("Your company workspace.")} />
			<dl className="grid gap-4 rounded-lg border p-4 text-sm">
				<div><dt className="text-muted-foreground">{t("Company")}</dt><dd>{shell.organizationName}</dd></div>
				<div><dt className="text-muted-foreground">{t("Your role")}</dt><dd>{t(roleMessage(shell.organizationRole))}</dd></div>
				<div><dt className="text-muted-foreground">{t("Active branch")}</dt><dd>{shell.activeBranch?.name ?? t("No branch selected")}</dd></div>
			</dl>
			<section className="grid max-w-xl gap-3 rounded-lg border p-4">
				<h2 className="font-medium">{t("My language")}</h2>
				<p className="text-sm text-muted-foreground">{t("Your preference applies to your account across companies. Automatic follows the active company's language.")}</p>
				<LanguagePicker />
			</section>
			{company?.id === shell.organizationId && <CompanyLanguageForm key={company.id} company={company} />}
			<p className="max-w-prose text-sm text-muted-foreground">{t("Timezone, currency and product-specific settings are not editable in this starter.")}</p>
		</PageContainer>
	);
}

function CompanyLanguageForm({ company }: { company: NonNullable<LocalePreferences["organization"]> }) {
	const { t, saveCompanyLocale } = useI18n();
	const [draft, setDraft] = useState<Locale | null | undefined>(undefined);
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<"saved" | "failed" | null>(null);
	const selection = draft === undefined ? company.locale : draft;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending || !company.canEdit) return;
		setPending(true);
		setFeedback(null);
		try { await saveCompanyLocale(selection); setDraft(undefined); setFeedback("saved"); }
		catch { setFeedback("failed"); }
		finally { setPending(false); }
	}
	return <form onSubmit={submit} className="grid max-w-xl gap-3 rounded-lg border p-4">
		<label htmlFor="company-language" className="font-medium">{t("Company language")}</label>
		<p className="text-sm text-muted-foreground">{t("People using Automatic follow this language. Personal preferences are preserved. Names and other entered data are not translated.")}</p>
		<select id="company-language" value={selection ?? ""} className="h-10 min-w-0 rounded-md border bg-background px-3" disabled={pending || !company.canEdit}
			onChange={(event) => { setDraft(isLocale(event.target.value) ? event.target.value : null); setFeedback(null); }}>
			<option value="">{t("Application default ({language})", { language: languages[DEFAULT_LOCALE].name })}</option>
			{localeOptions.map((option) => <option key={option.value} value={option.value} lang={option.value}>{option.name}</option>)}
		</select>
		{company.canEdit ? <Button type="submit" disabled={pending}>{t(pending ? "Saving…" : "Save company language")}</Button>
			: <p className="text-sm text-muted-foreground">{t("Only a company owner or administrator can change the company language.")}</p>}
		{feedback && <p role={feedback === "failed" ? "alert" : "status"} className="text-sm">{t(feedback === "saved" ? "Company language saved." : "We could not save the language. Please try again.")}</p>}
	</form>;
}
