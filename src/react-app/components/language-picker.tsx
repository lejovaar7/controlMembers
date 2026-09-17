import { SelectField } from "@/components/select-field";
import { useId, useState } from "react";
import { Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/loader";
import { isLocale, languages, localeOptions, resolveLocale } from "../../shared/i18n";
import { useI18n } from "@/lib/i18n";

/** A browser choice before login; a persisted personal preference after login. */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
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
		<div className="relative min-w-0">
		{compact && <Globe2 aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />}
		<SelectField id={id} className={cn("h-11 min-w-0 w-full max-w-full rounded-md border bg-background px-2 text-sm ", compact ? "h-11 rounded-xl border-transparent bg-muted/50 pl-9 pr-3 hover:bg-muted" : "lg:max-w-48")} disabled={pending} value={authenticated ? preferences?.userLocale ?? (canUseCompanyLanguage ? "" : locale) : locale} onValueChange={(value) => void change(value)} options={[...(canUseCompanyLanguage ? [{ value: "", label: t(compact ? "{language} · Company" : "Use company language ({language})", { language: languages[companyLocale].name }) }] : []), ...localeOptions.map((option) => ({ value: option.value, lang: option.value, label: option.name }))]} />
		</div>
		{pending && <Loader size="inline" label={t("Saving…")} />}
		{failed && <p role="alert" className="text-sm text-destructive">{t("We could not save the language. Please try again.")}</p>}
	</div>;
}
