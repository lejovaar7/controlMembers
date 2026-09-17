import { LoadingButton } from "@/components/loading-button";
import type { MessageKey } from "../../shared/i18n";
import { useT } from "@/lib/i18n";
import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { useI18n } from "@/lib/i18n";

export function VerifyEmailPage() {
	const t = useT();
	const { locale } = useI18n();
	const [searchParams] = useSearchParams();

	// Better Auth verifies the token on the server and redirects here. We only
	// read flags: the token itself is never handled by the browser.
	const verified = searchParams.get("verified") === "1";
	const failed = Boolean(searchParams.get("error"));
	const sentTo = searchParams.get("sent");

	const [email, setEmail] = useState(sentTo ?? "");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<MessageKey | null>(null);
	const [error, setError] = useState<MessageKey | null>(null);

	async function handleResend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setStatus(null);
		setError(null);

		const { error: sendError } = await authClient.sendVerificationEmail({
			email,
			callbackURL: "/verify-email?verified=1",
			fetchOptions: { headers: { "X-App-Locale": locale } },
		}).catch(() => ({ error: { code: "NETWORK_ERROR" } }));

		if (sendError) {
			setError(authErrorMessage(sendError));
			setSubmitting(false);
			return;
		}

		setStatus("If that account needs verification, a new link is on its way.");
		setSubmitting(false);
	}

	if (verified) {
		return (
			<AuthCard
				title={t("Email verified")}
				description={t("Your address is confirmed. You can sign in now.")}
			>
				<Button nativeButton={false} render={<Link to="/login" />} className="w-full">
					{t("Go to sign in")}</Button>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={failed ? t("Verification failed") : t("Check your email")}
			description={
				failed
					? t("That link is invalid or has expired. Request a new one.")
					: t("Open the link we sent to finish setting up your account.")
			}
			footer={<Link to="/login" className="underline">{t("Back to sign in")}</Link>}
		>
			<form onSubmit={handleResend} className="flex flex-col gap-4">
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

				<LoadingButton loading={submitting} loadingLabel={t("Sending…")} type="submit" variant="outline" disabled={submitting}>
					{t("Resend verification email")}
				</LoadingButton>
			</form>
		</AuthCard>
	);
}
