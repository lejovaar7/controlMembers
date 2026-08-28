/** Better Auth error codes mapped to stable, non-revealing copy. */
const MESSAGES: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
	INVALID_EMAIL: "Enter a valid email address.",
	INVALID_PASSWORD: "Incorrect password.",
	EMAIL_NOT_VERIFIED: "Verify your email before signing in.",
	USER_ALREADY_EXISTS: "An account with that email already exists.",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"An account with that email already exists.",
	PASSWORD_TOO_SHORT: "That password is too short.",
	PASSWORD_TOO_LONG: "That password is too long.",
	INVALID_TOKEN: "That link is invalid or has expired.",
	TOKEN_EXPIRED: "That link has expired.",
	EMAIL_ALREADY_VERIFIED: "That email is already verified.",
	SESSION_EXPIRED: "Your session expired. Sign in again.",
};

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Never surface a raw Better Auth message; unknown codes fall back. */
export function authErrorMessage(error?: { code?: string } | null): string {
	const code = error?.code;
	return (code && MESSAGES[code]) || GENERIC_ERROR;
}

export function isEmailNotVerified(error?: { code?: string } | null): boolean {
	return error?.code === "EMAIL_NOT_VERIFIED";
}
