import { createTranslator, DEFAULT_LOCALE, languages, type Locale, type MessageKey } from "../../shared/i18n";

type EmailContent = { subject: string; text: string; html: string };

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function message(locale: Locale, heading: string, paragraph: string, action: MessageKey, footer: MessageKey, url: string): EmailContent {
	const t = createTranslator(locale);
	const safeUrl = escapeHtml(url);
	return {
		subject: heading,
		text: `${paragraph}\n\n${url}\n\n${t(footer)}`,
		html: [
			`<div lang="${locale}" dir="${languages[locale].dir}" style="font-family:system-ui,sans-serif;line-height:1.5;max-width:32rem">`,
			`<h1 style="font-size:1.25rem">${escapeHtml(heading)}</h1>`,
			`<p>${escapeHtml(paragraph)}</p>`,
			`<p><a href="${safeUrl}">${escapeHtml(t(action))}</a></p>`,
			`<p style="color:#666;font-size:0.875rem">${escapeHtml(t("If the link does not work, copy this URL into your browser:"))}<br>${safeUrl}</p>`,
			`<p>${escapeHtml(t(footer))}</p>`,
			"</div>",
		].join(""),
	};
}

export function verificationEmail(url: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
	const t = createTranslator(locale);
	return message(locale, t("Verify your email"), t("Confirm your email address to finish setting up your account."),
		"Verify email", "If you did not create an account, you can ignore this email.", url);
}

export function passwordResetEmail(url: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
	const t = createTranslator(locale);
	return message(locale, t("Reset your password"), t("Use the link below to choose a new password."),
		"Reset password", "If you did not request a password reset, you can ignore this email.", url);
}

export function organizationInvitationEmail(
	organizationName: string,
	inviterName: string,
	url: string,
	locale: Locale = DEFAULT_LOCALE,
): EmailContent {
	const t = createTranslator(locale);
	return {
		...message(locale, t("You have been invited to access {company}", { company: organizationName }), t("{inviter} gave you access to {company}.", { inviter: inviterName, company: organizationName }),
			"Accept invitation", "If you were not expecting this invitation, you can ignore this email.", url),
		subject: t("Access to {company}", { company: organizationName }),
	};
}

export function accountSetupEmail(url: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
	const t = createTranslator(locale);
	return message(locale, t("Finish setting up your account"),
		t("You have been given access to the application. Use this secure link to confirm your address and choose a password."),
		"Set up my account", "If you were not expecting this, you can ignore this email.", url);
}
