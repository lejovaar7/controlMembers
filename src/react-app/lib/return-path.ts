export const DEFAULT_RETURN_PATH = "/app/dashboard";

/**
 * Accepts only same-app absolute paths, so a crafted `returnTo` cannot turn
 * login into an open redirect. Anything else falls back to the dashboard.
 */
export function safeReturnPath(value: string | null | undefined): string {
	if (!value) return DEFAULT_RETURN_PATH;
	if (!value.startsWith("/")) return DEFAULT_RETURN_PATH;
	// "//host" and "/\\host" are protocol-relative URLs, not internal paths.
	if (value.startsWith("//") || value.startsWith("/\\")) {
		return DEFAULT_RETURN_PATH;
	}
	if (value.includes("\\")) return DEFAULT_RETURN_PATH;
	for (const character of value) {
		const code = character.codePointAt(0) ?? 0;
		if (code < 0x20 || code === 0x7f) return DEFAULT_RETURN_PATH;
	}
	return value;
}
