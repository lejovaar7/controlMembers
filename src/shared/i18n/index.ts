import { en, type Catalog, type MessageKey } from "./en";
import { es } from "./es";

/** Add a complete catalog and metadata here to enable another language everywhere. */
export const languages = {
	en: { name: "English", intl: "en", dir: "ltr", messages: en },
	es: { name: "Español", intl: "es", dir: "ltr", messages: es },
} as const satisfies Record<string, { name: string; intl: string; dir: "ltr" | "rtl"; messages: Catalog }>;

export type Locale = keyof typeof languages;
export type { MessageKey, Catalog } from "./en";
export const DEFAULT_LOCALE: Locale = "en";
export const localeOptions = Object.entries(languages).map(([value, language]) => ({ value: value as Locale, ...language }));

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(languages, value);
}

/** Reads tolerate legacy regional codes; writes must be an exact registered key. */
export function normalizeLocale(value: unknown): Locale | null {
	if (typeof value !== "string" || value.length > 64) return null;
	const normalized = value.trim().replace(/_/g, "-").toLowerCase();
	try { Intl.getCanonicalLocales(normalized); } catch { return null; }
	const parts = normalized.split("-");
	while (parts.length) {
		const match = localeOptions.find((option) => option.value.toLowerCase() === parts.join("-"));
		if (match) return match.value;
		parts.pop();
	}
	return null;
}

export function resolveLocale(userLocale?: unknown, companyLocale?: unknown): Locale {
	return normalizeLocale(userLocale) ?? normalizeLocale(companyLocale) ?? DEFAULT_LOCALE;
}

export function publicLocale(explicit: unknown, saved: unknown, browserLanguages: readonly string[]): Locale {
	return normalizeLocale(explicit) ?? normalizeLocale(saved) ?? browserLanguages.map(normalizeLocale).find((locale) => locale !== null) ?? DEFAULT_LOCALE;
}

export function createTranslator(locale: Locale) {
	return (key: MessageKey, parameters: Record<string, string | number> = {}): string => {
		// Fallback also protects a rolling deployment with an older catalog chunk.
		const message = languages[locale].messages[key] || en[key];
		return message.replace(/\{(\w+)\}/g, (_, name: string) => String(parameters[name] ?? `{${name}}`));
	};
}

export function roleMessage(role: string | null | undefined): MessageKey {
	return role === "owner" ? "Owner" : role === "admin" ? "Admin" : "User";
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions) {
	return new Intl.NumberFormat(languages[locale].intl, options).format(value);
}

/** A readable currency label for selectors and section-level context. */
export function currencyName(locale: Locale, currency: string) {
	const name = new Intl.NumberFormat(languages[locale].intl, { style: "currency", currency, currencyDisplay: "name" }).formatToParts(2).find((part) => part.type === "currency")?.value ?? currency;
	return name.charAt(0).toLocaleUpperCase(languages[locale].intl) + name.slice(1);
}

/** Amounts in this product are stored in hundredths, independently of locale. */
export function formatMoney(locale: Locale, minor: number, currency: string) {
	const symbol = new Intl.NumberFormat(languages[locale].intl, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
	const amount = formatNumber(locale, minor / 100, { minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 });
	// Keep the symbol first and attached to the amount across all UI languages.
	return `${symbol}\u00a0${amount}`;
}

export function formatDate(locale: Locale, value: Date | number, options?: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat(languages[locale].intl, options).format(value);
}

/** Shared transport only: no frontend/Worker platform imports in this directory. */
export type LocalePreferences = {
	userLocale: Locale | null;
	organization: { id: string; locale: Locale; canEdit: boolean } | null;
};

/** A response from another user/company must never be used while a new request loads. */
export function currentPreferences(
	value: { key: string; preferences: LocalePreferences } | null,
	key: string,
): LocalePreferences | null {
	return value?.key === key ? value.preferences : null;
}
