type EmailMessage = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

/**
 * The only place that talks to the Cloudflare EMAIL binding. Application and
 * auth code passes plain messages and never sees the sending implementation.
 */
export function getEmailService(env: Env) {
	return {
		async send(message: EmailMessage) {
			const result = await env.EMAIL.send({
				from: env.EMAIL_FROM,
				to: message.to,
				subject: message.subject,
				text: message.text,
				html: message.html,
			});
			console.log("Email sent", {
				messageId: result.messageId,
			});
		},
	};
}
