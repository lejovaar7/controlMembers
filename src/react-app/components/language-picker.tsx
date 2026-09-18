import { SelectField } from "@/components/select-field";
import { useId, useState } from "react";
import spanishFlag from "flag-icons/flags/4x3/es.svg";
import englishFlag from "flag-icons/flags/4x3/us.svg";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/loader";
import { isLocale, languages, localeOptions, resolveLocale, type Locale } from "../../shared/i18n";
import { useI18n } from "@/lib/i18n";

const languageFlags = { es: spanishFlag, en: englishFlag } satisfies Record<Locale, string>;

function LanguageLabel({ locale, label }: { locale: Locale; label: string }) {
	return <span className="inline-flex max-w-full items-center gap-2.5 align-middle">
		<img src={languageFlags[locale]} alt="" aria-hidden="true" draggable={false} width={20} height={15} className="h-[15px] w-5 shrink-0 rounded-[3px] object-cover ring-1 ring-black/10" />
		<span className="min-w-0 truncate">{label}</span>
	</span>;
}

/** A browser choice before login; a persisted personal preference after login. */
export function LanguagePicker({ compact = false, allowCompanyLanguage = false }: { compact?: boolean; allowCompanyLanguage?: boolean }) {
	const { t, locale, preferences, authenticated, setPublicLocale, saveUserLocale } = useI18n();
	const id = useId();
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const canUseCompanyLanguage = allowCompanyLanguage && authenticated && Boolean(preferences?.organization);
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
		<div className="relative min-w-0">
		<SelectField id={id} popupClassName="min-w-44" className={cn("h-11 min-w-0 w-full max-w-full rounded-md border bg-background px-2 text-sm ", compact ? "h-11 rounded-xl border-transparent bg-muted/50 px-3 hover:bg-muted" : "lg:max-w-48")} disabled={pending} value={authenticated ? preferences?.userLocale ?? (canUseCompanyLanguage ? "" : locale) : locale} onValueChange={(value) => void change(value)} options={[...(canUseCompanyLanguage ? [{ value: "", label: <LanguageLabel locale={companyLocale} label={t("Use company language ({language})", { language: languages[companyLocale].name })} /> }] : []), ...localeOptions.map((option) => ({ value: option.value, lang: option.value, label: <LanguageLabel locale={option.value} label={option.name} /> }))]} />
		</div>
		{pending && <Loader size="inline" label={t("Saving…")} />}
		{failed && <p role="alert" className="text-sm text-destructive">{t("We could not save the language. Please try again.")}</p>}
	</div>;
}
