import { createContext, useContext } from "react";
import { createTranslator, type Locale, type LocalePreferences } from "../../shared/i18n";

export type I18nContextValue = {
	locale: Locale;
	t: ReturnType<typeof createTranslator>;
	authenticated: boolean;
	preferences: LocalePreferences | null;
	setPublicLocale: (locale: Locale) => void;
	saveUserLocale: (locale: Locale | null) => Promise<void>;
	saveCompanyLocale: (locale: Locale) => Promise<void>;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
	const context = useContext(I18nContext);
	if (!context) throw new Error("I18nProvider is required");
	return context;
}

export function useT() {
	return useI18n().t;
}
