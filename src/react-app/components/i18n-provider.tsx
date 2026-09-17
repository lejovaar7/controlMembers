import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createTranslator, currentPreferences, languages, normalizeLocale, publicLocale, resolveLocale, type Locale, type LocalePreferences } from "../../shared/i18n";
import { authClient, useSession } from "@/lib/auth-client";
import { I18nContext } from "@/lib/i18n";
import { Loader } from "@/components/loader";

const STORAGE_KEY = "app.public-language";

function initialPublicLocale() {
	let saved: string | null = null;
	try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* Storage can be disabled. */ }
	return publicLocale(new URLSearchParams(window.location.search).get("lang"), saved, navigator.languages);
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const { data: session, isPending } = useSession();
	const userId = session?.user.id;
	const organizationId = session?.session.activeOrganizationId ?? null;
	const key = JSON.stringify([userId, organizationId]);
	const [publicLanguage, setPublicLanguage] = useState(initialPublicLocale);
	// Account activation has a session but may not have an active company yet.
	const [setupLanguage] = useState(() => window.location.pathname === "/setup-account" ? normalizeLocale(new URLSearchParams(window.location.search).get("lang")) : null);
	const [remote, setRemote] = useState<{ key: string; preferences: LocalePreferences } | null>(null);
	const [failedKey, setFailedKey] = useState<string | null>(null);
	const request = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });
	const preferences = currentPreferences(remote, key);
	const locale = userId ? resolveLocale(preferences?.userLocale, preferences?.organization ? preferences.organization.locale : setupLanguage) : publicLanguage;
	const t = useMemo(() => createTranslator(locale), [locale]);

	const refresh = useCallback(() => {
		request.current.controller?.abort();
		const generation = ++request.current.generation;
		if (!userId) return;
		const controller = new AbortController();
		request.current.controller = controller;
		return fetch("/api/account/locale", { signal: controller.signal }).then(async (response) => {
			if (!response.ok) throw new Error("Language preferences unavailable");
			return await response.json() as LocalePreferences;
		}).then((result) => {
			if (result.organization && result.organization.id !== organizationId) throw new Error("Workspace changed");
			if (generation !== request.current.generation || controller.signal.aborted) return;
			setRemote({ key, preferences: result });
			setFailedKey(null);
		}).catch(() => {
			if (!controller.signal.aborted && generation === request.current.generation) setFailedKey(key);
		});
	}, [key, userId, organizationId, setRemote, setFailedKey]);

	useEffect(() => {
		const activeRequest = request.current;
		void refresh();
		const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
		const interval = window.setInterval(onFocus, 30_000);
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onFocus);
		return () => {
			activeRequest.controller?.abort();
			window.clearInterval(interval);
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onFocus);
		};
	}, [refresh]);

	useEffect(() => {
		document.documentElement.lang = locale;
		document.documentElement.dir = languages[locale].dir;
		document.title = t("ControlMembers");
	}, [locale, t]);

	function setPublicLocale(next: Locale) {
		setPublicLanguage(next);
		try { localStorage.setItem(STORAGE_KEY, next); } catch { /* In-memory choice still works. */ }
		// An email language hint must not override a later explicit selection on reload.
		const url = new URL(window.location.href);
		if (url.searchParams.has("lang")) {
			url.searchParams.set("lang", next);
			window.history.replaceState(window.history.state, "", url);
		}
	}

	async function saveLocale(path: string, next: Locale | null) {
		request.current.controller?.abort();
		++request.current.generation;
		const response = await fetch(path, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...(path === "/api/company/locale" ? { "X-Company-Context": preferences?.organization?.id ?? "" } : {}) },
			body: JSON.stringify({ locale: next }),
		});
		if (!response.ok) throw new Error("Language preference update failed");
		// Update the matching context immediately, retaining mounted forms and message keys.
		setRemote((previous) => previous?.key !== key ? previous : {
			key, preferences: path === "/api/account/locale"
				? { ...previous.preferences, userLocale: next }
				: { ...previous.preferences, organization: previous.preferences.organization ? { ...previous.preferences.organization, locale: resolveLocale(null, next) } : null },
		});
		await refresh();
	}

	// Do not render one company's language while another context is being resolved.
	if (isPending || (userId && !preferences)) {
		const fallback = createTranslator(publicLanguage);
		return <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6" lang={publicLanguage}>
			{failedKey === key ? <p role="alert">{fallback("We could not load language preferences.")}</p> : <Loader label={fallback("Loading language preferences…")} />}
			{failedKey === key && <>
				<button className="rounded-md border px-4 py-2" onClick={() => void refresh()}>{fallback("Try again")}</button>
				<button className="underline" onClick={() => void authClient.signOut().then(() => window.location.assign("/login"))}>{fallback("Sign out")}</button>
			</>}
		</div>;
	}

	return <I18nContext.Provider value={{ locale, t, preferences, authenticated: Boolean(userId), setPublicLocale,
		saveUserLocale: (next) => saveLocale("/api/account/locale", next), saveCompanyLocale: (next) => saveLocale("/api/company/locale", next) }}>
		{children}
	</I18nContext.Provider>;
}
