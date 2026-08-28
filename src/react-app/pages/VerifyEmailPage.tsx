import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function VerifyEmailPage() {
	const [searchParams] = useSearchParams();

	// Better Auth verifies the token on the server and redirects here. We only
	// read flags: the token itself is never handled by the browser.
	const verified = searchParams.get("verified") === "1";
	const failed = Boolean(searchParams.get("error"));
	const sentTo = searchParams.get("sent");

	const [email, setEmail] = useState(sentTo ?? "");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleResend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setStatus(null);
		setError(null);

		const { error: sendError } = await authClient.sendVerificationEmail({
			email,
			callbackURL: "/verify-email?verified=1",
		});

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
				title="Email verified"
				description="Your address is confirmed. You can sign in now."
			>
				<Button render={<Link to="/login" />} className="w-full">
					Go to sign in
				</Button>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={failed ? "Verification failed" : "Check your email"}
			description={
				failed
					? "That link is invalid or has expired. Request a new one."
					: "Open the link we sent to finish setting up your account."
			}
			footer={<Link to="/login" className="underline">Back to sign in</Link>}
		>
			<form onSubmit={handleResend} className="flex flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="email">Email</Label>
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

				<FormMessage>{error}</FormMessage>
				<FormMessage tone="success">{status}</FormMessage>

				<Button type="submit" variant="outline" disabled={submitting}>
					{submitting ? "Sending\u2026" : "Resend verification email"}
				</Button>
			</form>
		</AuthCard>
	);
}
