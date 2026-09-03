import type { MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";

const GENERIC_SENT =
	"If an account exists for that email, you will receive a password reset link.";

export function ForgotPasswordPage() {
	const t = useT();
	const { locale } = useI18n();
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<MessageKey | null>(null);
	const [error, setError] = useState<MessageKey | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setStatus(null);
		setError(null);

		const { error: requestError } = await authClient.requestPasswordReset({
			email,
			redirectTo: "/reset-password",
			fetchOptions: { headers: { "X-App-Locale": locale } },
		}).catch(() => ({ error: { code: "NETWORK_ERROR" } }));

		if (requestError) {
			setError(authErrorMessage(requestError));
			setSubmitting(false);
			return;
		}

		// Deliberately identical whether or not the account exists.
		setStatus(GENERIC_SENT);
		setSubmitting(false);
	}

	return (
		<AuthCard
			title={t("Forgot password")}
			description={t("We will email you a link to choose a new password.")}
			footer={<Link to="/login" className="underline">{t("Back to sign in")}</Link>}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="email">{t("Email")}</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</div>

				<FormMessage>{error ? t(error) : null}</FormMessage>
				<FormMessage tone="success">{status ? t(status) : null}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? t("Sending…") : t("Send reset link")}
				</Button>
			</form>
		</AuthCard>
	);
}
