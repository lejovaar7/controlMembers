import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, FormMessage } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function ResetPasswordPage() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	// Better Auth redirects here with ?token=... on success or ?error=... when
	// the link is bad. The token is passed straight back to Better Auth and is
	// never inspected, rendered or logged here.
	const token = searchParams.get("token");
	const linkError = searchParams.get("error");

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!token || linkError) {
		return (
			<AuthCard
				title="Reset link problem"
				description="That link is invalid or has expired."
				footer={<Link to="/login" className="underline">Back to sign in</Link>}
			>
				<Button render={<Link to="/forgot-password" />} className="w-full">
					Request a new link
				</Button>
			</AuthCard>
		);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const form = event.currentTarget;
		const data = new FormData(form);
		const newPassword = String(data.get("newPassword") ?? "");
		const confirmPassword = String(data.get("confirmPassword") ?? "");

		if (newPassword !== confirmPassword) {
			setError("Those passwords do not match.");
			return;
		}

		setSubmitting(true);
		setError(null);

		const { error: resetError } = await authClient.resetPassword({
			newPassword,
			token: token ?? undefined,
		}).catch(() => ({ error: { code: "NETWORK_ERROR" } }));

		if (resetError) {
			setError(authErrorMessage(resetError));
			form.reset();
			setSubmitting(false);
			return;
		}

		form.reset();
		navigate("/login?reset=success", { replace: true });
	}

	return (
		<AuthCard
			title="Reset password"
			description="Choose a new password for your account."
			footer={<Link to="/login" className="underline">Back to sign in</Link>}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4">
				<div className="grid gap-2">
					<Label htmlFor="newPassword">New password</Label>
					<Input
						id="newPassword"
						name="newPassword"
						type="password"
						autoComplete="new-password"
						minLength={8}
						maxLength={128}
						required
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="confirmPassword">Confirm new password</Label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						required
						aria-describedby={error ? "reset-error" : undefined}
					/>
				</div>

				<FormMessage id="reset-error">{error}</FormMessage>

				<Button type="submit" disabled={submitting}>
					{submitting ? "Saving\u2026" : "Change password"}
				</Button>
			</form>
		</AuthCard>
	);
}
