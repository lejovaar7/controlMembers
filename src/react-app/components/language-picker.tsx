import { useId, useState } from "react";
import { isLocale, languages, localeOptions, resolveLocale } from "../../shared/i18n";
import { useI18n } from "@/lib/i18n";

/** A browser choice before login; a persisted personal preference after login. */
export function LanguagePicker() {
	const { t, locale, preferences, authenticated, setPublicLocale, saveUserLocale } = useI18n();
	const id = useId();
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const canUseCompanyLanguage = authenticated && Boolean(preferences?.organization);
	const companyLocale = resolveLocale(null, preferences?.organization?.locale);
	async function change(value: string) {
		if (pending || (!isLocale(value) && !(value === "" && canUseCompanyLanguage))) return;
		setFailed(false);
		if (!authenticated) { if (isLocale(value)) setPublicLocale(value); return; }
		setPending(true);
		try { await saveUserLocale(isLocale(value) ? value : null); }
		catch { setFailed(true); }
		finally { setPending(false); }
	}
	return <div className="flex min-w-0 max-w-full flex-col gap-1">
		<label htmlFor={id} className="sr-only">{t(authenticated ? "My language" : "Language")}</label>
		<select id={id} className="h-9 min-w-0 max-w-full rounded-md border bg-background px-2 text-sm" disabled={pending}
			value={authenticated ? preferences?.userLocale ?? (canUseCompanyLanguage ? "" : locale) : locale} onChange={(event) => void change(event.target.value)}>
			{canUseCompanyLanguage && <option value="">{t("Use company language ({language})", { language: languages[companyLocale].name })}</option>}
			{localeOptions.map((option) => <option key={option.value} value={option.value} lang={option.value}>{option.name}</option>)}
		</select>
		{failed && <p role="alert" className="text-sm text-destructive">{t("We could not save the language. Please try again.")}</p>}
	</div>;
}
