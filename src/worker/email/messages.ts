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
		text: `${paragraph}\n\n${t(action)}: ${url}\n\n${t(footer)}`,
		html: [
			`<div lang="${locale}" dir="${languages[locale].dir}" style="font-family:Arial,sans-serif;line-height:1.6;max-width:512px;margin:24px auto;padding:24px;color:#172b4d;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px">`,
			`<p style="margin:0 0 24px;font-size:14px;font-weight:700;color:#52627a">ControlMembers</p>`,
			`<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${escapeHtml(heading)}</h1>`,
			`<p>${escapeHtml(paragraph)}</p>`,
			`<p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:14px 24px;background-color:#172b4d;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;text-align:center;text-decoration:none">${escapeHtml(t(action))}</a></p>`,
			`<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;color:#52627a;font-size:13px">${escapeHtml(t(footer))}</p>`,
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
