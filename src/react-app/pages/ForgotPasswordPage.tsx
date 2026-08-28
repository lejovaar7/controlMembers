import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

const GENERIC_SENT =
	"If an account exists for that email, you will receive a password reset link.";

export function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setStatus(null);
		setError(null);

		const { error: requestError } = await authClient.requestPasswordReset({
			email,
			redirectTo: "/reset-password",
		});

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
			title="Forgot password"
			description="We will email you a link to choose a new password."
			footer={<Link to="/login" className="underline">Back to sign in</Link>}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

				<Button type="submit" disabled={submitting}>
					{submitting ? "Sending\u2026" : "Send reset link"}
				</Button>
			</form>
		</AuthCard>
	);
}
