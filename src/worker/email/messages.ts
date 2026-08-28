type EmailContent = {
	subject: string;
	text: string;
	html: string;
};

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function layout(heading: string, paragraph: string, action: string, url: string) {
	const safeUrl = escapeHtml(url);
	return [
		'<div style="font-family:system-ui,sans-serif;line-height:1.5;max-width:32rem">',
		`<h1 style="font-size:1.25rem">${heading}</h1>`,
		`<p>${paragraph}</p>`,
		`<p><a href="${safeUrl}">${action}</a></p>`,
		`<p style="color:#666;font-size:0.875rem">If the link does not work, copy this URL into your browser:<br>${safeUrl}</p>`,
		"</div>",
	].join("");
}

export function verificationEmail(url: string): EmailContent {
	const heading = "Verify your email";
	const paragraph =
		"Confirm your email address to finish setting up your account.";
	return {
		subject: heading,
		text: `${paragraph}\n\n${url}\n\nIf you did not create an account, you can ignore this email.`,
		html: layout(heading, paragraph, "Verify email", url),
	};
}

export function passwordResetEmail(url: string): EmailContent {
	const heading = "Reset your password";
	const paragraph = "Use the link below to choose a new password.";
	return {
		subject: heading,
		text: `${paragraph}\n\n${url}\n\nIf you did not request a password reset, you can ignore this email.`,
		html: layout(heading, paragraph, "Reset password", url),
	};
}

export function organizationInvitationEmail(
	organizationName: string,
	inviterName: string,
	url: string,
): EmailContent {
	const heading = "You have been invited to join a team";
	const paragraph = `${inviterName} invited you to join ${organizationName}.`;
	return {
		subject: `Invitation to join ${organizationName}`,
		text: `${paragraph}\n\n${url}\n\nIf you were not expecting this invitation, you can ignore this email.`,
		html: layout(heading, paragraph, "Accept invitation", url),
	};
}

export function accountSetupEmail(url: string): EmailContent {
	const heading = "Finish setting up your account";
	const paragraph =
		"You have been given access to the application. Use this secure link to confirm your address and choose a password.";
	return {
		subject: heading,
		text: `${paragraph}\n\n${url}\n\nIf you were not expecting this, you can ignore this email.`,
		html: layout(heading, paragraph, "Set up my account", url),
	};
}
