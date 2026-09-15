import { DEFAULT_RETURN_PATH, safeReturnPath } from "./return-path";

export const PLATFORM_HOME_PATH = "/platform";

export function isPlatformAdminRole(role: unknown): boolean {
	return typeof role === "string" && role.split(",").some((value) => value.trim().toLowerCase() === "admin");
}

/** Honor a valid explicit destination; otherwise select the correct account home. */
export function authenticatedStartPath(returnTo: string | null | undefined, role: unknown): string {
	const safePath = safeReturnPath(returnTo);
	const hasExplicitSafePath = typeof returnTo === "string" && returnTo.length > 0 && safePath === returnTo;
	if (hasExplicitSafePath) return safePath;
	return isPlatformAdminRole(role) ? PLATFORM_HOME_PATH : DEFAULT_RETURN_PATH;
}
